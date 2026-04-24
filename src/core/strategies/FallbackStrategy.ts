/**
 * Fallback 策略 — 按顺序尝试每个 target，成功即返回
 * 支持嵌套：target 可以是叶节点或子策略组
 */
import type { Params } from '../../types/requestBody';
import type { endpointStrings } from '../../providers/types';
import type { StrategyResult, TargetConfig } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';
import { executeTarget, executeTargetStream, type InheritedConfig } from '../tryTarget';

export class FallbackStrategy {
  async execute(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings
  ): Promise<StrategyResult> {
    if (targets.length === 0) {
      throw new Error('No targets provided');
    }

    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs, endpoint };
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

  async executeStream(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    if (targets.length === 0) {
      throw new Error('No targets provided');
    }

    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs, endpoint };
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
}
