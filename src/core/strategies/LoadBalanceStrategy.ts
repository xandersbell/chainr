/**
 * LoadBalance 策略 — 按权重随机选择一个 target
 * 支持嵌套：选中的 target 可以是叶节点或子策略组
 */
import type { Params } from '../../types/requestBody';
import type { StrategyResult, TargetConfig } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';
import { executeTarget, executeTargetStream, type InheritedConfig } from '../tryTarget';

export class LoadBalanceStrategy {
  async execute(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number
  ): Promise<StrategyResult> {
    if (targets.length === 0) {
      throw new Error('No targets provided for load balance');
    }

    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs };
    const selected = this.selectByWeight(targets);
    return executeTarget(selected, params, inherited);
  }

  async executeStream(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    if (targets.length === 0) {
      throw new Error('No targets provided for load balance');
    }

    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs };
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
