/**
 * Single strategy — always use the first target
 * Supports nesting: a target can be a leaf node or a sub-strategy group
 */

import type { endpointStrings } from '../../providers/types';
import type { Params } from '../../types/requestBody';
import { executeTarget, executeTargetStream, type InheritedConfig } from '../tryTarget';
import type { StrategyResult, TargetConfig } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';

export class SingleStrategy {
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
    return executeTarget(targets[0], params, inherited);
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
    return executeTargetStream(targets[0], params, inherited);
  }
}
