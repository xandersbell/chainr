import type { Params } from '../../types/requestBody';
import type { StrategyResult } from '../types';
import { retryRequest } from '../RetryHandler';
import { transformRequest } from '../transformRequest';

export class FallbackStrategy {
  async execute(
    targets: Array<Record<string, unknown>>,
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] }
  ): Promise<StrategyResult> {
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const result = await this.tryTarget(target, params, retryConfig);
        if (result.success) {
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      success: false,
      error: lastError || 'All fallback targets exhausted',
    };
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