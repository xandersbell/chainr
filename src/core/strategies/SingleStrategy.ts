/**
 * Single 策略 — 始终使用第一个 target
 * 支持嵌套：target 可以是叶节点或子策略组
 */
import type { Params } from '../../types/requestBody';
import type { endpointStrings } from '../../providers/types';
import type { StrategyResult, TargetConfig } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';
import { executeTarget, executeTargetStream, type InheritedConfig } from '../tryTarget';

export class SingleStrategy {
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
    return executeTarget(targets[0], params, inherited);
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
    return executeTargetStream(targets[0], params, inherited);
  }
}
