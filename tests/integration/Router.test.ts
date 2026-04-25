import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChainrConfig, StrategyResult } from '../../src/core/types';
import type { Params } from '../../src/types/requestBody';

const mockFallbackExecute = vi.fn();
const mockLoadBalanceExecute = vi.fn();
const mockSingleExecute = vi.fn();

vi.mock('../../src/core/strategies', () => ({
  FallbackStrategy: class MockFallbackStrategy {
    execute = mockFallbackExecute;
    executeStream = vi.fn();
  },
  LoadBalanceStrategy: class MockLoadBalanceStrategy {
    execute = mockLoadBalanceExecute;
    executeStream = vi.fn();
  },
  SingleStrategy: class MockSingleStrategy {
    execute = mockSingleExecute;
    executeStream = vi.fn();
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

// mock fetchWithTimeout — 用于 executeSimpleEndpoint 测试（messages.countTokens 等）
const mockFetchWithTimeout = vi.fn();
vi.mock('../../src/core/RetryHandler', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
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

      expect(mockFallbackExecute).toHaveBeenCalledWith(targets, baseParams, retryConfig, undefined, 'chatComplete');
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

      expect(mockLoadBalanceExecute).toHaveBeenCalledWith(targets, baseParams, undefined, undefined, 'chatComplete');
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
        undefined,
        'chatComplete'
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
        undefined,
        'chatComplete'
      );
    });
  });

  describe('messages.create() — Anthropic Messages API', () => {
    const messagesParams: Params = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello Claude!' }],
      max_tokens: 1024,
    };

    const mockMessagesResponse = {
      id: 'msg-test-123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    it('非流式调用通过策略系统路由，使用 messages endpoint', async () => {
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'anthropic', apiKey: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockMessagesResponse,
        provider: 'anthropic',
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockMessagesResponse);

      const chainr = new Chainr(config);
      const result = await chainr.messages.create(messagesParams);

      // 验证策略调用时传入 'messages' endpoint
      expect(mockFallbackExecute).toHaveBeenCalledWith(
        config.targets,
        messagesParams,
        undefined,
        undefined,
        'messages'
      );
      // 验证响应转换使用 'messages' endpoint
      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        mockMessagesResponse,
        'anthropic',
        'messages'
      );
      expect(result).toEqual(mockMessagesResponse);
    });

    it('使用 messagesTargets 而非默认 targets', async () => {
      const messagesTargets = [{ provider: 'anthropic', apiKey: 'anthropic-key' }];
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'openai', apiKey: 'openai-key' }],
        messagesTargets,
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockMessagesResponse,
        provider: 'anthropic',
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockMessagesResponse);

      const chainr = new Chainr(config);
      await chainr.messages.create(messagesParams);

      // 应使用 messagesTargets 而非 targets
      expect(mockFallbackExecute).toHaveBeenCalledWith(
        messagesTargets,
        messagesParams,
        undefined,
        undefined,
        'messages'
      );
    });

    it('provider 缺失时默认使用 anthropic', async () => {
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'anthropic', apiKey: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockMessagesResponse,
        // provider 未设置
      };

      mockSingleExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockMessagesResponse);

      const chainr = new Chainr(config);
      await chainr.messages.create(messagesParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        mockMessagesResponse,
        'anthropic',
        'messages'
      );
    });

    it('retry 和 timeout 正确传递', async () => {
      const retryConfig = { attempts: 3, onStatusCodes: [429, 500] };
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'anthropic', apiKey: 'key-1' }],
        retry: retryConfig,
        timeout: 60000,
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockMessagesResponse,
        provider: 'anthropic',
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockMessagesResponse);

      const chainr = new Chainr(config);
      await chainr.messages.create(messagesParams);

      expect(mockFallbackExecute).toHaveBeenCalledWith(
        config.targets,
        messagesParams,
        retryConfig,
        60000,
        'messages'
      );
    });
  });

  describe('responses.create() — OpenAI Responses API', () => {
    const responsesParams: Params = {
      model: 'gpt-4o',
      // Responses API 使用 input 替代 messages
      input: 'Tell me a joke',
      instructions: 'You are a comedian',
    } as unknown as Params;

    const mockResponsesResult = {
      id: 'resp-test-123',
      object: 'response',
      model: 'gpt-4o',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Why did the chicken...' }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };

    it('非流式调用通过策略系统路由，使用 createModelResponse endpoint', async () => {
      const config: ChainrConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'openai', apiKey: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockResponsesResult,
        provider: 'openai',
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockResponsesResult);

      const chainr = new Chainr(config);
      const result = await chainr.responses.create(responsesParams);

      // 验证策略调用时传入 'createModelResponse' endpoint
      expect(mockFallbackExecute).toHaveBeenCalledWith(
        config.targets,
        responsesParams,
        undefined,
        undefined,
        'createModelResponse'
      );
      // 验证响应转换使用 'createModelResponse' endpoint
      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        mockResponsesResult,
        'openai',
        'createModelResponse'
      );
      expect(result).toEqual(mockResponsesResult);
    });

    it('使用 responsesTargets 而非默认 targets', async () => {
      const responsesTargets = [{ provider: 'openai', apiKey: 'responses-key' }];
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'anthropic', apiKey: 'anthropic-key' }],
        responsesTargets,
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockResponsesResult,
        provider: 'openai',
      };

      mockSingleExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockResponsesResult);

      const chainr = new Chainr(config);
      await chainr.responses.create(responsesParams);

      // 应使用 responsesTargets 而非 targets
      expect(mockSingleExecute).toHaveBeenCalledWith(
        responsesTargets,
        responsesParams,
        undefined,
        undefined,
        'createModelResponse'
      );
    });

    it('provider 缺失时默认使用 openai', async () => {
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'openai', apiKey: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockResponsesResult,
        // provider 未设置
      };

      mockSingleExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockResponsesResult);

      const chainr = new Chainr(config);
      await chainr.responses.create(responsesParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        mockResponsesResult,
        'openai',
        'createModelResponse'
      );
    });

    it('retry 和 timeout 正确传递', async () => {
      const retryConfig = { attempts: 2, onStatusCodes: [429, 502] };
      const config: ChainrConfig = {
        strategy: 'loadbalance',
        targets: [
          { provider: 'openai', apiKey: 'key-1', weight: 0.7 },
          { provider: 'openai', apiKey: 'key-2', weight: 0.3 },
        ],
        retry: retryConfig,
        timeout: 45000,
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockResponsesResult,
        provider: 'openai',
      };

      mockLoadBalanceExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockResponsesResult);

      const chainr = new Chainr(config);
      await chainr.responses.create(responsesParams);

      expect(mockLoadBalanceExecute).toHaveBeenCalledWith(
        config.targets,
        responsesParams,
        retryConfig,
        45000,
        'createModelResponse'
      );
    });
  });

  describe('messages.countTokens() — Anthropic Token 计数', () => {
    const countTokensParams: Params = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello Claude!' }],
    };

    const mockCountTokensResponse = { input_tokens: 12 };

    // executeSimpleEndpoint 直接调用 buildProviderRequest，需要每个测试重新设置 mock
    const setupMocks = async () => {
      const { buildProviderRequest } = await import('../../src/core/providerRequest');
      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: { model: 'claude-sonnet-4-20250514', messages: countTokensParams.messages },
        headers: { 'x-api-key': 'key-1', 'content-type': 'application/json' },
        url: 'https://api.anthropic.com/v1/messages/count_tokens',
      });
    };

    it('调用 messagesCountTokens 端点并返回 token 计数', async () => {
      await setupMocks();
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'anthropic', apiKey: 'key-1' }],
      };

      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCountTokensResponse),
        headers: new Headers(),
      });
      mockTransformProviderResponse.mockReturnValue(mockCountTokensResponse);

      const chainr = new Chainr(config);
      const result = await chainr.messages.countTokens(countTokensParams);

      expect(result).toEqual(mockCountTokensResponse);
    });

    it('使用 messagesTargets 而非默认 targets', async () => {
      await setupMocks();
      const messagesTargets = [{ provider: 'anthropic', apiKey: 'anthropic-key' }];
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'openai', apiKey: 'openai-key' }],
        messagesTargets,
      };

      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCountTokensResponse),
        headers: new Headers(),
      });
      mockTransformProviderResponse.mockReturnValue(mockCountTokensResponse);

      const chainr = new Chainr(config);
      await chainr.messages.countTokens(countTokensParams);

      // buildProviderRequest 应收到 messagesTargets 中的 target
      const { buildProviderRequest } = await import('../../src/core/providerRequest');
      expect(buildProviderRequest).toHaveBeenCalledWith(
        countTokensParams,
        'anthropic',
        messagesTargets[0],
        'messagesCountTokens'
      );
    });

    it('请求失败时抛出错误', async () => {
      await setupMocks();
      const config: ChainrConfig = {
        strategy: 'single',
        targets: [{ provider: 'anthropic', apiKey: 'key-1' }],
      };

      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Unauthorized' } }),
        headers: new Headers(),
      });

      const chainr = new Chainr(config);
      await expect(chainr.messages.countTokens(countTokensParams)).rejects.toThrow('HTTP 401');
    });
  });
});
