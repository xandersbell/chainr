/**
 * Core recursive dispatch module
 * Handles leaf nodes (direct requests) and nested strategy groups (recursive dispatch to sub-strategies)
 * Also responsible for config inheritance: overrideParams merging, retry/timeout child-priority
 */
import type { Params } from '../types/requestBody';
import { getUnsupportedMultimodalRequirement } from './multimodalCapabilities';
import { buildProviderRequest } from './providerRequest';
import { retryRequest, retryRequestForStream } from './RetryHandler';
import { createAnthropicStream, isAnthropicProvider } from './transformAnthropicStream';
import { createBedrockStream, isBedrockProvider } from './transformBedrockStream';
import { createBytezStream, isBytezProvider } from './transformBytezStream';
import { createCohereStream, isCohereProvider } from './transformCohereStream';
import { createGoogleStream, isGoogleProvider } from './transformGoogleStream';
import { createOpenAIStream, isOpenAICompatibleProvider } from './transformOpenAIStream';
import type { StrategyResult, TargetConfig } from './types';
import type { ChatCompletionChunk } from './types/streaming';

/**
 * Inherited config — passed down from parent level
 * endpoint: specifies the endpoint type for the current request, determines which ProviderConfig mapping to use
 */
export interface InheritedConfig {
  overrideParams?: Record<string, unknown>;
  retry?: { attempts?: number; onStatusCodes?: number[] };
  timeout?: number;
  endpoint?: import('../providers/types').endpointStrings;
}

/**
 * Check whether a target is a nested strategy group (has strategy + targets fields)
 */
export function isNestedTarget(target: TargetConfig): boolean {
  return !!target.strategy && Array.isArray(target.targets) && target.targets.length > 0;
}

/**
 * Build the inherited config for the current level
 * Rules: overrideParams merge (parent as base, current overrides), retry/timeout child-priority
 */
export function buildInheritedConfig(
  target: TargetConfig,
  parentConfig: InheritedConfig,
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
    // endpoint is inherited from parent, not overridden by child targets (determined by top-level Router)
    endpoint: parentConfig.endpoint,
  };
}

/**
 * Send actual HTTP request to a leaf target (non-streaming)
 */
export async function tryLeafTarget(
  target: TargetConfig,
  params: Params,
  inherited: InheritedConfig,
): Promise<StrategyResult> {
  const provider = (target.provider as string) || 'openai';
  const mergedParams = { ...params, ...(inherited.overrideParams || {}) };

  const endpoint = inherited.endpoint || 'chatComplete';
  const unsupportedReason = getUnsupportedMultimodalRequirement(provider, mergedParams, endpoint);
  if (unsupportedReason) {
    throw new Error(`Unsupported multimodal input: ${unsupportedReason}`);
  }

  const { body, headers, url } = await buildProviderRequest(
    mergedParams,
    provider,
    target,
    endpoint,
  );

  const retryResult = await retryRequest(
    url,
    { method: 'POST', headers, body: JSON.stringify(body) },
    inherited.retry,
    inherited.timeout,
  );

  return {
    success: retryResult.success,
    response: retryResult.response,
    provider,
    error: retryResult.error,
  };
}

/**
 * Send actual HTTP request to a leaf target (streaming)
 */
export async function tryLeafTargetStream(
  target: TargetConfig,
  params: Params,
  inherited: InheritedConfig,
): Promise<ReadableStream<ChatCompletionChunk>> {
  const provider = (target.provider as string) || 'openai';
  const mergedParams = {
    ...params,
    stream: true,
    ...(inherited.overrideParams || {}),
  };

  const endpoint = inherited.endpoint || 'chatComplete';
  const unsupportedReason = getUnsupportedMultimodalRequirement(provider, mergedParams, endpoint);
  if (unsupportedReason) {
    throw new Error(`Unsupported multimodal input: ${unsupportedReason}`);
  }

  const { body, headers, url } = await buildProviderRequest(
    mergedParams,
    provider,
    target,
    endpoint,
  );

  const retryResult = await retryRequestForStream(
    url,
    { method: 'POST', headers, body: JSON.stringify(body) },
    inherited.retry,
    inherited.timeout,
  );

  if (!retryResult.success || !retryResult.response) {
    throw new Error(retryResult.error || 'Stream request failed');
  }

  return createStreamForProvider(retryResult.response, provider);
}

/**
 * Create the appropriate stream transform based on provider type
 */
export function createStreamForProvider(
  response: Response,
  provider: string,
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
 * Recursively execute a target (non-streaming)
 * If target is a nested strategy group, recursively dispatch to the corresponding strategy; otherwise send request directly
 */
export async function executeTarget(
  target: TargetConfig,
  params: Params,
  parentConfig: InheritedConfig,
): Promise<StrategyResult> {
  const inherited = buildInheritedConfig(target, parentConfig);

  if (isNestedTarget(target)) {
    // Nested strategy group — recursive dispatch
    return executeNestedStrategy(target.strategy!, target.targets!, params, inherited);
  }

  // Leaf node — send request directly
  return tryLeafTarget(target, params, inherited);
}

/**
 * Recursively execute a target (streaming)
 */
export async function executeTargetStream(
  target: TargetConfig,
  params: Params,
  parentConfig: InheritedConfig,
): Promise<ReadableStream<ChatCompletionChunk>> {
  const inherited = buildInheritedConfig(target, parentConfig);

  if (isNestedTarget(target)) {
    return executeNestedStrategyStream(target.strategy!, target.targets!, params, inherited);
  }

  return tryLeafTargetStream(target, params, inherited);
}

/**
 * Execute nested strategy (non-streaming) — dispatch based on strategy type
 */
function executeNestedStrategy(
  strategy: string,
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig,
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
 * Execute nested strategy (streaming)
 */
function executeNestedStrategyStream(
  strategy: string,
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig,
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

// --- Inline strategy implementations (avoid circular dependencies) ---

async function executeFallback(
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig,
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
  inherited: InheritedConfig,
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
  const totalWeight = targets.reduce((sum, t) => sum + ((t.weight as number) ?? 1), 0);
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
  inherited: InheritedConfig,
): Promise<StrategyResult> {
  const selected = selectByWeight(targets);
  return executeTarget(selected, params, inherited);
}

async function executeLoadBalanceStream(
  targets: TargetConfig[],
  params: Params,
  inherited: InheritedConfig,
): Promise<ReadableStream<ChatCompletionChunk>> {
  const selected = selectByWeight(targets);
  return executeTargetStream(selected, params, inherited);
}
