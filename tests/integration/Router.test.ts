import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChainrConfig, StrategyResult } from '../../src/core/types';
import type { Params } from '../../src/types/requestBody';

const mockFallbackExecute = vi.fn();
const mockLoadBalanceExecute = vi.fn();
const mockSingleExecute = vi.fn();

vi.mock('../../src/core/strategies', () => ({
  FallbackStrategy: class MockFallbackStrategy {
    execute = mockFallbackExecute;
  },
  LoadBalanceStrategy: class MockLoadBalanceStrategy {
    execute = mockLoadBalanceExecute;
  },
  SingleStrategy: class MockSingleStrategy {
    execute = mockSingleExecute;
  },
}));

const mockTransformProviderResponse = vi.fn();

vi.mock('../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn().mockResolvedValue({
    body: {},
    headers: {},
    url: 'https://api.openai.com/v1/chat/completions',
  }),
  transformProviderResponse: (...args: unknown[]) => mockTransformProviderResponse(...args),
}));

import { Chainr } from '../../src/core/Router';

const mockChatCompletionResponse = {
  id: 'chatcmpl-test-123',
  object: 'chat.completion',
  created: 1714000000,
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello!' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const mockErrorResponse = {
  error: {
    message: 'Rate limit exceeded',
    type: 'rate_limit_error',
    param: null,
    code: '429',
    provider: 'openai',
  },
};

const baseParams: Params = {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
};

describe('Chainr (Router) 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor - 策略实例化', () => {
    it('strategy 为 "fallback" 时，实例化 FallbackStrategy', () => {
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const chainr = new Chainr(config);
      const strategy = (chainr as unknown as { strategy: { execute: typeof mockFallbackExecute } }).strategy;

      expect(strategy.execute).toBe(mockFallbackExecute);
    });

    it('strategy 为 "loadbalance" 时，实例化 LoadBalanceStrategy', () => {
      const config: ChainrConfig = {
        strategy: 'loadbalance',
        targets: [
          { provider: 'openai', api_key: 'key-1', weight: 0.7 },
          { provider: 'openai', api_key: 'key-2', weight: 0.3 },
        ],
      };

      const chainr = new Chainr(config);
      const strategy = (chainr as unknown as { strategy: { execute: typeof mockLoadBalanceExecute } }).strategy;

      expect(strategy.execute).toBe(mockLoadBalanceExecute);
    });

    it('strategy 为 "single" 时，实例化 SingleStrategy', () => {
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const chainr = new Chainr(config);
      const strategy = (chainr as unknown as { strategy: { execute: typeof mockSingleExecute } }).strategy;

      expect(strategy.execute).toBe(mockSingleExecute);
    });

    it('strategy 为未知模式时，抛出 "Unknown strategy mode: {mode}" 错误', () => {
      const config = {
        strategy: 'roundrobin',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      } as unknown as ChainrConfig;

      expect(() => new Chainr(config)).toThrow('Unknown strategy mode: roundrobin');
    });
  });

  describe('chat.completions.create()', () => {
    it('策略返回成功响应时，通过 transformProviderResponse 转换后返回', async () => {
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: { status: 200, data: mockChatCompletionResponse },
        provider: 'openai',
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockChatCompletionResponse);

      const chainr = new Chainr(config);
      const result = await chainr.chat.completions.create(baseParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledOnce();
      expect(result).toEqual(mockChatCompletionResponse);
    });

    it('策略返回错误响应时，仍通过 transformProviderResponse 转换后返回', async () => {
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const errorResponse = { status: 429, data: { error: { message: 'Rate limit exceeded' } } };

      const strategyResult: StrategyResult = {
        success: false,
        response: errorResponse,
        provider: 'openai',
        error: 'HTTP 429',
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockErrorResponse);

      const chainr = new Chainr(config);
      const result = await chainr.chat.completions.create(baseParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledOnce();
      expect(result).toEqual(mockErrorResponse);
    });

    it('使用 result.provider 传递给 transformProviderResponse', async () => {
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'anthropic', api_key: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: { status: 200, data: { id: 'msg-123' } },
        provider: 'anthropic',
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockChatCompletionResponse);

      const chainr = new Chainr(config);
      await chainr.chat.completions.create(baseParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        expect.anything(),
        'anthropic',
        'chatComplete'
      );
    });

    it('result.provider 缺失时，默认使用 "openai" 传递给 transformProviderResponse', async () => {
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: { status: 200, data: { id: 'msg-456' } },
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockChatCompletionResponse);

      const chainr = new Chainr(config);
      await chainr.chat.completions.create(baseParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        expect.anything(),
        'openai',
        'chatComplete'
      );
    });
  });

  describe('executeChatCompletions() - 完整管道', () => {
    it('完整管道：config → strategy.execute() → transformProviderResponse()', async () => {
      const targets = [
        { provider: 'openai', api_key: 'key-1' },
        { provider: 'anthropic', api_key: 'key-2' },
      ];
      const retryConfig = { attempts: 3, onStatusCodes: [429, 500] };

      const config: ChainrConfig = {
        strategy: 'fallback',
        targets,
        retry: retryConfig,
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: { status: 200, data: mockChatCompletionResponse },
        provider: 'openai',
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockChatCompletionResponse);

      const chainr = new Chainr(config);
      const result = await chainr.chat.completions.create(baseParams);

      expect(mockFallbackExecute).toHaveBeenCalledWith(targets, baseParams, retryConfig, undefined);
      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        strategyResult.response as unknown as Record<string, unknown>,
        'openai',
        'chatComplete'
      );
      expect(result).toEqual(mockChatCompletionResponse);
    });

    it('config.targets 正确传递给 strategy.execute()', async () => {
      const targets = [
        { provider: 'openai', api_key: 'key-1', weight: 0.6 },
        { provider: 'openai', api_key: 'key-2', weight: 0.4 },
      ];

      const config: ChainrConfig = {
        strategy: 'loadbalance',
        targets,
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: { status: 200, data: mockChatCompletionResponse },
        provider: 'openai',
      };

      mockLoadBalanceExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockChatCompletionResponse);

      const chainr = new Chainr(config);
      await chainr.chat.completions.create(baseParams);

      expect(mockLoadBalanceExecute).toHaveBeenCalledWith(targets, baseParams, undefined, undefined);
    });

    it('config.retry 正确传递给 strategy.execute() 作为 retryConfig', async () => {
      const retryConfig = { attempts: 5, onStatusCodes: [500, 502, 503] };
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
        retry: retryConfig,
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: { status: 200, data: mockChatCompletionResponse },
        provider: 'openai',
      };

      mockSingleExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockChatCompletionResponse);

      const chainr = new Chainr(config);
      await chainr.chat.completions.create(baseParams);

      expect(mockSingleExecute).toHaveBeenCalledWith(
        expect.any(Array),
        baseParams,
        retryConfig,
        undefined
      );
    });

    it('config.retry 未设置时，strategy.execute() 接收 undefined', async () => {
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: { status: 200, data: mockChatCompletionResponse },
        provider: 'openai',
      };

      mockSingleExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockChatCompletionResponse);

      const chainr = new Chainr(config);
      await chainr.chat.completions.create(baseParams);

      expect(mockSingleExecute).toHaveBeenCalledWith(
        expect.any(Array),
        baseParams,
        undefined,
        undefined
      );
    });
  });
});
