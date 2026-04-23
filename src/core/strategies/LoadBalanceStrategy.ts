import type { Params } from '../../types/requestBody';
import type { StrategyResult } from '../types';
import { retryRequest } from '../RetryHandler';
import { transformRequest } from '../transformRequest';

export class LoadBalanceStrategy {
  async execute(
    targets: Array<Record<string, unknown>>,
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] }
  ): Promise<StrategyResult> {
    if (targets.length === 0) {
      throw new Error('No targets provided for load balance');
    }

    const selectedTarget = this.selectByWeight(targets);
    return this.tryTarget(selectedTarget, params, retryConfig);
  }

  private selectByWeight(targets: Array<Record<string, unknown>>): Record<string, unknown> {
    const normalizedTargets = targets.map(t => ({
      ...t,
      weight: (t['weight'] as number) ?? 1,
    }));

    const totalWeight = normalizedTargets.reduce((sum, t) => sum + (t['weight'] as number), 0);
    const randomWeight = Math.random() * totalWeight;

    let cumulativeWeight = 0;
    for (const target of normalizedTargets) {
      cumulativeWeight += target['weight'] as number;
      if (randomWeight < cumulativeWeight) {
        return target;
      }
    }

    return normalizedTargets[normalizedTargets.length - 1];
  }

  private async tryTarget(
    target: Record<string, unknown>,
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] }
  ): Promise<StrategyResult> {
    const provider = (target['provider'] as string) || 'openai';
    const mergedParams = { ...params, ...(target['overrideParams'] as Record<string, unknown>) };

    const { body, headers, url } = transformRequest(mergedParams, provider, target);

    const retryResult = await retryRequest(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      retryConfig || (target['retry'] as { attempts?: number; onStatusCodes?: number[] })
    );

    return {
      success: retryResult.success,
      response: retryResult.response,
      provider,
      error: retryResult.error,
    };
  }
}