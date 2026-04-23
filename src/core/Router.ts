import type { Params } from '../types/requestBody';
import type { ChainrConfig, StrategyResult } from './types';
import { FallbackStrategy, LoadBalanceStrategy, SingleStrategy } from './strategies';
import { transformResponse } from './transformResponse';

export class Chainr {
  private config: ChainrConfig;
  private strategy: FallbackStrategy | LoadBalanceStrategy | SingleStrategy;

  constructor(config: ChainrConfig) {
    this.config = config;
    this.strategy = this.createStrategy(config.strategy);
  }

  private createStrategy(mode: string): FallbackStrategy | LoadBalanceStrategy | SingleStrategy {
    switch (mode) {
      case 'fallback':
        return new FallbackStrategy();
      case 'loadbalance':
        return new LoadBalanceStrategy();
      case 'single':
        return new SingleStrategy();
      default:
        throw new Error(`Unknown strategy mode: ${mode}`);
    }
  }

  chat = {
    completions: {
      create: (params: Params): Promise<import('./types').ChatCompletionResponse | import('./types').ErrorResponse> => {
        return this.executeChatCompletions(params);
      },
    },
  };

  private async executeChatCompletions(params: Params): Promise<import('./types').ChatCompletionResponse | import('./types').ErrorResponse> {
    const result: StrategyResult = await this.strategy.execute(this.config.targets, params, this.config.retry);
    const transformed = transformResponse(
      result.response as unknown as Record<string, unknown>,
      result.provider || 'openai'
    );
    return transformed;
  }
}