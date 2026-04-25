import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StrategyResult } from '../../src/core/types';

const mockFallbackExecute = vi.fn();
const mockSingleExecute = vi.fn();

vi.mock('../../src/core/strategies', () => ({
  FallbackStrategy: class MockFallbackStrategy {
    execute = mockFallbackExecute;
  },
  LoadBalanceStrategy: class MockLoadBalanceStrategy {
    execute = vi.fn();
  },
  SingleStrategy: class MockSingleStrategy {
    execute = mockSingleExecute;
  },
}));

vi.mock('../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn().mockResolvedValue({
    body: {},
    headers: {},
    url: 'https://api.openai.com/v1/chat/completions',
  }),
  transformProviderResponse: vi.fn().mockReturnValue({}),
}));

import { Priorai } from '../../src/core/Router';

describe('Timeout propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes config.timeout as the 4th argument to strategy.execute()', async () => {
    const strategyResult: StrategyResult = {
      success: true,
      response: { status: 200, data: {} },
      provider: 'openai',
    };
    mockFallbackExecute.mockResolvedValue(strategyResult);

    const priorai = new Priorai({
      strategy: 'fallback',
      targets: [{ provider: 'openai', apiKey: 'test' }],
      timeout: 15000,
    });

    await priorai.chat.completions.create({ model: 'gpt-4o', messages: [] });

    expect(mockFallbackExecute).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      undefined,
      15000,
      'chatComplete',
    );
  });

  it('when config.timeout is not set, the 4th argument to strategy.execute() is undefined', async () => {
    const strategyResult: StrategyResult = {
      success: true,
      response: { status: 200, data: {} },
      provider: 'openai',
    };
    mockSingleExecute.mockResolvedValue(strategyResult);

    const priorai = new Priorai({
      strategy: 'single',
      targets: [{ provider: 'openai', apiKey: 'test' }],
    });

    await priorai.chat.completions.create({ model: 'gpt-4o', messages: [] });

    expect(mockSingleExecute).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      undefined,
      undefined,
      'chatComplete',
    );
  });

  it('passes both config.timeout and config.retry together', async () => {
    const strategyResult: StrategyResult = {
      success: true,
      response: { status: 200, data: {} },
      provider: 'openai',
    };
    mockFallbackExecute.mockResolvedValue(strategyResult);

    const retryConfig = { attempts: 3, onStatusCodes: [429] };
    const priorai = new Priorai({
      strategy: 'fallback',
      targets: [{ provider: 'openai', apiKey: 'test' }],
      retry: retryConfig,
      timeout: 60000,
    });

    await priorai.chat.completions.create({ model: 'gpt-4o', messages: [] });

    expect(mockFallbackExecute).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      retryConfig,
      60000,
      'chatComplete',
    );
  });
});
