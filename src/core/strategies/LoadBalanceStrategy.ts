/**
 * LoadBalance strategy — randomly select a target based on weights
 * Supports nesting: the selected target can be a leaf node or a sub-strategy group
 */
import type { Params } from '../../types/requestBody';
import type { endpointStrings } from '../../providers/types';
import type { StrategyResult, TargetConfig } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';
import { executeTarget, executeTargetStream, type InheritedConfig } from '../tryTarget';

export class LoadBalanceStrategy {
  async execute(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings
  ): Promise<StrategyResult> {
    if (targets.length === 0) {
      throw new Error('No targets provided for load balance');
    }

    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs, endpoint };
    const selected = this.selectByWeight(targets);
    return executeTarget(selected, params, inherited);
  }

  async executeStream(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    if (targets.length === 0) {
      throw new Error('No targets provided for load balance');
    }

    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs, endpoint };
    const selected = this.selectByWeight(targets);
    return executeTargetStream(selected, params, inherited);
  }

  private selectByWeight(targets: TargetConfig[]): TargetConfig {
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
}
