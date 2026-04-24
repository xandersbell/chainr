import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import { Chainr } from '../../src/core/Router';

describe('Timeout 传递', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('config.timeout 传递给 strategy.execute() 第 4 参数', async () => {
    const strategyResult: StrategyResult = {
      success: true,
      response: { status: 200, data: {} },
      provider: 'openai',
    };
    mockFallbackExecute.mockResolvedValue(strategyResult);

    const chainr = new Chainr({
      strategy: 'fallback',
      targets: [{ provider: 'openai', apiKey: 'test' }],
      timeout: 15000,
    });

    await chainr.chat.completions.create({ model: 'gpt-4o', messages: [] });

    expect(mockFallbackExecute).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      undefined,
      15000,
      'chatComplete'
    );
  });

  it('config.timeout 未设置时，strategy.execute() 第 4 参数为 undefined', async () => {
    const strategyResult: StrategyResult = {
      success: true,
      response: { status: 200, data: {} },
      provider: 'openai',
    };
    mockSingleExecute.mockResolvedValue(strategyResult);

    const chainr = new Chainr({
      strategy: 'single',
      targets: [{ provider: 'openai', apiKey: 'test' }],
    });

    await chainr.chat.completions.create({ model: 'gpt-4o', messages: [] });

    expect(mockSingleExecute).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      undefined,
      undefined,
      'chatComplete'
    );
  });

  it('config.timeout 与 config.retry 同时传递', async () => {
    const strategyResult: StrategyResult = {
      success: true,
      response: { status: 200, data: {} },
      provider: 'openai',
    };
    mockFallbackExecute.mockResolvedValue(strategyResult);

    const retryConfig = { attempts: 3, onStatusCodes: [429] };
    const chainr = new Chainr({
      strategy: 'fallback',
      targets: [{ provider: 'openai', apiKey: 'test' }],
      retry: retryConfig,
      timeout: 60000,
    });

    await chainr.chat.completions.create({ model: 'gpt-4o', messages: [] });

    expect(mockFallbackExecute).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      retryConfig,
      60000,
      'chatComplete'
    );
  });
});
