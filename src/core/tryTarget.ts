/**
 * 核心递归调度模块
 * 处理叶节点（直接发请求）和嵌套策略组（递归调度到子策略）
 * 同时负责配置继承：overrideParams 合并，retry/timeout 子级优先
 */
import type { Params } from '../types/requestBody';
import type { StrategyResult, TargetConfig } from './types';
import type { ChatCompletionChunk } from './types/streaming';
import { retryRequest, retryRequestForStream } from './RetryHandler';
import { buildProviderRequest } from './providerRequest';
import { createOpenAIStream, isOpenAICompatibleProvider } from './transformOpenAIStream';
import { createAnthropicStream, isAnthropicProvider } from './transformAnthropicStream';
import { createGoogleStream, isGoogleProvider } from './transformGoogleStream';
import { createCohereStream, isCohereProvider } from './transformCohereStream';
import { createBedrockStream, isBedrockProvider } from './transformBedrockStream';
import { createBytezStream, isBytezProvider } from './transformBytezStream';

/**
 * 继承配置 — 从父级向下传递的配置
 * endpoint: 指定当前请求的端点类型，决定使用哪个 ProviderConfig 映射
 */
export interface InheritedConfig {
  overrideParams?: Record<string, unknown>;
  retry?: { attempts?: number; onStatusCodes?: number[] };
  timeout?: number;
  endpoint?: import('../providers/types').endpointStrings;
}

/**
 * 判断 target 是否为嵌套策略组（有 strategy + targets 字段）
 */
export function isNestedTarget(target: TargetConfig): boolean {
  return !!target.strategy && Array.isArray(target.targets) && target.targets.length > 0;
}

/**
 * 构建当前层级的继承配置
 * 规则：overrideParams 合并（父级铺底，当前覆盖），retry/timeout 当前优先
 */
export function buildInheritedConfig(
  target: TargetConfig,
  parentConfig: InheritedConfig
): InheritedConfig {
  return {
    overrideParams: {
      ...parentConfig.overrideParams,
      ...(target.overrideParams || {}),
    },
    retry: target.retry
      ? { ...target.retry }
      : parentConfig.retry
        ? { ...parentConfig.retry }
        : undefined,
    timeout: target.timeout ?? parentConfig.timeout,
    // endpoint 从父级继承，不被子 target 覆盖（由顶层 Router 决定）
    endpoint: parentConfig.endpoint,
  };
}

/**
 * 对叶节点发起实际 HTTP 请求（非流式）
 */
export async function tryLeafTarget(
  target: TargetConfig,
  params: Params,
  inherited: InheritedConfig
): Promise<StrategyResult> {
  const provider = (target.provider as string) || 'openai';
  const mergedParams = { ...params, ...(inherited.overrideParams || {}) };

  const endpoint = inherited.endpoint || 'chatComplete';
  const { body, headers, url } = await buildProviderRequest(mergedParams, provider, target, endpoint);

  const retryResult = await retryRequest(
    url,
    { method: 'POST', headers, body: JSON.stringify(body) },
    inherited.retry,
    inherited.timeout
  );

  return {
    success: retryResult.success,
    response: retryResult.response,
    provider,
    error: retryResult.error,
  };
}

/**
 * 对叶节点发起实际 HTTP 请求（流式）
 */
export async function tryLeafTargetStream(
  target: TargetConfig,
  params: Params,
  inherited: InheritedConfig
): Promise<ReadableStream<ChatCompletionChunk>> {
  const provider = (target.provider as string) || 'openai';
  const mergedParams = {
    ...params,
    stream: true,
    ...(inherited.overrideParams || {}),
  };

  const endpoint = inherited.endpoint || 'chatComplete';
  const { body, headers, url } = await buildProviderRequest(mergedParams, provider, target, endpoint);

  const retryResult = await retryRequestForStream(
    url,
    { method: 'POST', headers, body: JSON.stringify(body) },
    inherited.retry,
    inherited.timeout
  );

  if (!retryResult.success || !retryResult.response) {
    throw new Error(retryResult.error || 'Stream request failed');
  }

  return createStreamForProvider(retryResult.response, provider);
}

/**
 * 根据 provider 类型创建对应的流式转换
 */
export function createStreamForProvider(
  response: Response,
  provider: string
): ReadableStream<ChatCompletionChunk> {
  if (isAnthropicProvider(provider)) return createAnthropicStream(response, provider);
  if (isGoogleProvider(provider)) return createGoogleStream(response, provider);
  if (isCohereProvider(provider)) return createCohereStream(response, provider);
  if (isBedrockProvider(provider)) return createBedrockStream(response, provider);
  if (isBytezProvider(provider)) return createBytezStream(response, provider);
  if (isOpenAICompatibleProvider(provider)) return createOpenAIStream(response, provider);
  return createOpenAIStream(response, provider);
}

/**
 * 递归执行目标（非流式）
 * 如果 target 是嵌套策略组，递归调度到对应策略；否则直接发请求
 */
export async function executeTarget(
  target: TargetConfig,
  params: Params,
  parentConfig: InheritedConfig
): Promise<StrategyResult> {
  const inherited = buildInheritedConfig(target, parentConfig);

  if (isNestedTarget(target)) {
    // 嵌套策略组 — 递归调度
    return executeNestedStrategy(
      target.strategy!,
      target.targets!,
      params,
      inherited
    );
  }

  // 叶节点 — 直接发请求
  return tryLeafTarget(target, params, inherited);
}

/**
 * 递归执行目标（流式）
 */
export async function executeTargetStream(
  target: TargetConfig,
  params: Params,
  parentConfig: InheritedConfig
): Promise<ReadableStream<ChatCompletionChunk>> {
  const inherited = buildInheritedConfig(target, parentConfig);

  if (isNestedTarget(target)) {
    return executeNestedStrategyStream(
      target.strategy!,
      target.targets!,
      params,
      inherited
    );
  }

  return tryLeafTargetStream(target, params, inherited);
}

/**
 * 执行嵌套策略（非流式）— 根据 strategy 类型分发
 */
function executeNestedStrategy(
  strategy: string,
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig
): Promise<StrategyResult> {
  switch (strategy) {
    case 'fallback':
      return executeFallback(targets, params, inherited);
    case 'loadbalance':
      return executeLoadBalance(targets, params, inherited);
    case 'single':
      return executeTarget(targets[0], params, inherited);
    default:
      throw new Error(`Unknown nested strategy: ${strategy}`);
  }
}

/**
 * 执行嵌套策略（流式）
 */
function executeNestedStrategyStream(
  strategy: string,
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig
): Promise<ReadableStream<ChatCompletionChunk>> {
  switch (strategy) {
    case 'fallback':
      return executeFallbackStream(targets, params, inherited);
    case 'loadbalance':
      return executeLoadBalanceStream(targets, params, inherited);
    case 'single':
      return executeTargetStream(targets[0], params, inherited);
    default:
      throw new Error(`Unknown nested strategy: ${strategy}`);
  }
}

// --- 内联策略实现（避免循环依赖） ---

async function executeFallback(
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig
): Promise<StrategyResult> {
  let lastError: string | undefined;
  for (const target of targets) {
    try {
      const result = await executeTarget(target, params, inherited);
      if (result.success) return result;
      lastError = result.error;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return { success: false, error: lastError || 'All fallback targets exhausted' };
}

async function executeFallbackStream(
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig
): Promise<ReadableStream<ChatCompletionChunk>> {
  let lastError: string | undefined;
  for (const target of targets) {
    try {
      return await executeTargetStream(target, params, inherited);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || 'All fallback targets exhausted for streaming');
}

function selectByWeight(targets: TargetConfig[]): TargetConfig {
  const totalWeight = targets.reduce(
    (sum, t) => sum + ((t.weight as number) ?? 1), 0
  );
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const target of targets) {
    cumulative += (target.weight as number) ?? 1;
    if (rand < cumulative) return target;
  }
  return targets[targets.length - 1];
}

async function executeLoadBalance(
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig
): Promise<StrategyResult> {
  const selected = selectByWeight(targets);
  return executeTarget(selected, params, inherited);
}

async function executeLoadBalanceStream(
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig
): Promise<ReadableStream<ChatCompletionChunk>> {
  const selected = selectByWeight(targets);
  return executeTargetStream(selected, params, inherited);
}
