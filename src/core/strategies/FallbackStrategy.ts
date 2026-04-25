/**
 * Fallback strategy — try each target in order, return on first success
 * Supports nesting: a target can be a leaf node or a sub-strategy group
 */

import type { endpointStrings } from '../../providers/types';
import type { Params } from '../../types/requestBody';
import { executeTarget, executeTargetStream, type InheritedConfig } from '../tryTarget';
import type { StrategyResult, TargetConfig } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';

export class FallbackStrategy {
  async execute(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings,
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
    endpoint?: endpointStrings,
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
