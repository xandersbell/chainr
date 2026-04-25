import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrioraiConfig, StrategyResult } from '../../src/core/types';
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

// mock fetchWithTimeout — used for executeSimpleEndpoint tests (messages.countTokens etc.)
const mockFetchWithTimeout = vi.fn();
vi.mock('../../src/core/RetryHandler', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

import { Priorai } from '../../src/core/Router';

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

describe('Priorai (Router) integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor - strategy instantiation', () => {
    it('when strategy is "fallback", instantiates FallbackStrategy', () => {
      const config: PrioraiConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const priorai = new Priorai(config);
      const strategy = (priorai as unknown as { strategy: { execute: typeof mockFallbackExecute } })
        .strategy;

      expect(strategy.execute).toBe(mockFallbackExecute);
    });

    it('when strategy is "loadbalance", instantiates LoadBalanceStrategy', () => {
      const config: PrioraiConfig = {
        strategy: 'loadbalance',
        targets: [
          { provider: 'openai', api_key: 'key-1', weight: 0.7 },
          { provider: 'openai', api_key: 'key-2', weight: 0.3 },
        ],
      };

      const priorai = new Priorai(config);
      const strategy = (
        priorai as unknown as { strategy: { execute: typeof mockLoadBalanceExecute } }
      ).strategy;

      expect(strategy.execute).toBe(mockLoadBalanceExecute);
    });

    it('when strategy is "single", instantiates SingleStrategy', () => {
      const config: PrioraiConfig = {
        strategy: 'single',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const priorai = new Priorai(config);
      const strategy = (priorai as unknown as { strategy: { execute: typeof mockSingleExecute } })
        .strategy;

      expect(strategy.execute).toBe(mockSingleExecute);
    });

    it('when strategy is unknown, throws "Unknown strategy mode: {mode}" error', () => {
      const config = {
        strategy: 'roundrobin',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      } as unknown as PrioraiConfig;

      expect(() => new Priorai(config)).toThrow('Unknown strategy mode: roundrobin');
    });
  });

  describe('chat.completions.create()', () => {
    it('when strategy returns success, transforms via transformProviderResponse and returns', async () => {
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      const result = await priorai.chat.completions.create(baseParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledOnce();
      expect(result).toEqual(mockChatCompletionResponse);
    });

    it('when strategy returns error response, still transforms via transformProviderResponse and returns', async () => {
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      const result = await priorai.chat.completions.create(baseParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledOnce();
      expect(result).toEqual(mockErrorResponse);
    });

    it('passes result.provider to transformProviderResponse', async () => {
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.chat.completions.create(baseParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        expect.anything(),
        'anthropic',
        'chatComplete',
        200,
        {},
        'gpt-4o',
      );
    });

    it('when result.provider is missing, defaults to "openai" for transformProviderResponse', async () => {
      const config: PrioraiConfig = {
        strategy: 'fallback',
        targets: [{ provider: 'openai', api_key: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: { status: 200, data: { id: 'msg-456' } },
      };

      mockFallbackExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockChatCompletionResponse);

      const priorai = new Priorai(config);
      await priorai.chat.completions.create(baseParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        expect.anything(),
        'openai',
        'chatComplete',
        200,
        {},
        'gpt-4o',
      );
    });
  });

  describe('executeChatCompletions() - full pipeline', () => {
    it('full pipeline: config → strategy.execute() → transformProviderResponse()', async () => {
      const targets = [
        { provider: 'openai', api_key: 'key-1' },
        { provider: 'anthropic', api_key: 'key-2' },
      ];
      const retryConfig = { attempts: 3, onStatusCodes: [429, 500] };

      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      const result = await priorai.chat.completions.create(baseParams);

      expect(mockFallbackExecute).toHaveBeenCalledWith(
        targets,
        baseParams,
        retryConfig,
        undefined,
        'chatComplete',
      );
      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        strategyResult.response as unknown as Record<string, unknown>,
        'openai',
        'chatComplete',
        200,
        {},
        'gpt-4o',
      );
      expect(result).toEqual(mockChatCompletionResponse);
    });

    it('config.targets is correctly passed to strategy.execute()', async () => {
      const targets = [
        { provider: 'openai', api_key: 'key-1', weight: 0.6 },
        { provider: 'openai', api_key: 'key-2', weight: 0.4 },
      ];

      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.chat.completions.create(baseParams);

      expect(mockLoadBalanceExecute).toHaveBeenCalledWith(
        targets,
        baseParams,
        undefined,
        undefined,
        'chatComplete',
      );
    });

    it('config.retry is correctly passed to strategy.execute() as retryConfig', async () => {
      const retryConfig = { attempts: 5, onStatusCodes: [500, 502, 503] };
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.chat.completions.create(baseParams);

      expect(mockSingleExecute).toHaveBeenCalledWith(
        expect.any(Array),
        baseParams,
        retryConfig,
        undefined,
        'chatComplete',
      );
    });

    it('when config.retry is not set, strategy.execute() receives undefined', async () => {
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.chat.completions.create(baseParams);

      expect(mockSingleExecute).toHaveBeenCalledWith(
        expect.any(Array),
        baseParams,
        undefined,
        undefined,
        'chatComplete',
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

    it('non-streaming call routes through strategy system using messages endpoint', async () => {
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      const result = await priorai.messages.create(messagesParams);

      // Verify strategy is called with 'messages' endpoint
      expect(mockFallbackExecute).toHaveBeenCalledWith(
        config.targets,
        messagesParams,
        undefined,
        undefined,
        'messages',
      );
      // Verify response transform uses 'messages' endpoint
      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        mockMessagesResponse,
        'anthropic',
        'messages',
        200,
        {},
        'claude-sonnet-4-20250514',
      );
      expect(result).toEqual(mockMessagesResponse);
    });

    it('uses messagesTargets instead of default targets', async () => {
      const messagesTargets = [{ provider: 'anthropic', apiKey: 'anthropic-key' }];
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.messages.create(messagesParams);

      // Should use messagesTargets instead of targets
      expect(mockFallbackExecute).toHaveBeenCalledWith(
        messagesTargets,
        messagesParams,
        undefined,
        undefined,
        'messages',
      );
    });

    it('defaults to anthropic when provider is missing', async () => {
      const config: PrioraiConfig = {
        strategy: 'single',
        targets: [{ provider: 'anthropic', apiKey: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockMessagesResponse,
        // provider not set
      };

      mockSingleExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockMessagesResponse);

      const priorai = new Priorai(config);
      await priorai.messages.create(messagesParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        mockMessagesResponse,
        'anthropic',
        'messages',
        200,
        {},
        'claude-sonnet-4-20250514',
      );
    });

    it('correctly passes retry and timeout', async () => {
      const retryConfig = { attempts: 3, onStatusCodes: [429, 500] };
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.messages.create(messagesParams);

      expect(mockFallbackExecute).toHaveBeenCalledWith(
        config.targets,
        messagesParams,
        retryConfig,
        60000,
        'messages',
      );
    });
  });

  describe('responses.create() — OpenAI Responses API', () => {
    const responsesParams: Params = {
      model: 'gpt-4o',
      // Responses API uses input instead of messages
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

    it('non-streaming call routes through strategy system using createModelResponse endpoint', async () => {
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      const result = await priorai.responses.create(responsesParams);

      // Verify strategy is called with 'createModelResponse' endpoint
      expect(mockFallbackExecute).toHaveBeenCalledWith(
        config.targets,
        responsesParams,
        undefined,
        undefined,
        'createModelResponse',
      );
      // Verify response transform uses 'createModelResponse' endpoint
      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        mockResponsesResult,
        'openai',
        'createModelResponse',
        200,
        {},
        'gpt-4o',
      );
      expect(result).toEqual(mockResponsesResult);
    });

    it('uses responsesTargets instead of default targets', async () => {
      const responsesTargets = [{ provider: 'openai', apiKey: 'responses-key' }];
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.responses.create(responsesParams);

      // Should use responsesTargets instead of targets
      expect(mockSingleExecute).toHaveBeenCalledWith(
        responsesTargets,
        responsesParams,
        undefined,
        undefined,
        'createModelResponse',
      );
    });

    it('defaults to openai when provider is missing', async () => {
      const config: PrioraiConfig = {
        strategy: 'single',
        targets: [{ provider: 'openai', apiKey: 'key-1' }],
      };

      const strategyResult: StrategyResult = {
        success: true,
        response: mockResponsesResult,
        // provider not set
      };

      mockSingleExecute.mockResolvedValue(strategyResult);
      mockTransformProviderResponse.mockReturnValue(mockResponsesResult);

      const priorai = new Priorai(config);
      await priorai.responses.create(responsesParams);

      expect(mockTransformProviderResponse).toHaveBeenCalledWith(
        mockResponsesResult,
        'openai',
        'createModelResponse',
        200,
        {},
        'gpt-4o',
      );
    });

    it('correctly passes retry and timeout', async () => {
      const retryConfig = { attempts: 2, onStatusCodes: [429, 502] };
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.responses.create(responsesParams);

      expect(mockLoadBalanceExecute).toHaveBeenCalledWith(
        config.targets,
        responsesParams,
        retryConfig,
        45000,
        'createModelResponse',
      );
    });
  });

  describe('messages.countTokens() — Anthropic Token Counting', () => {
    const countTokensParams: Params = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello Claude!' }],
    };

    const mockCountTokensResponse = { input_tokens: 12 };

    // executeSimpleEndpoint calls buildProviderRequest directly, mocks need resetting per test
    const setupMocks = async () => {
      const { buildProviderRequest } = await import('../../src/core/providerRequest');
      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: { model: 'claude-sonnet-4-20250514', messages: countTokensParams.messages },
        headers: { 'x-api-key': 'key-1', 'content-type': 'application/json' },
        url: 'https://api.anthropic.com/v1/messages/count_tokens',
      });
    };

    it('calls messagesCountTokens endpoint and returns token count', async () => {
      await setupMocks();
      const config: PrioraiConfig = {
        strategy: 'single',
        targets: [{ provider: 'anthropic', apiKey: 'key-1' }],
      };

      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCountTokensResponse),
        headers: new Headers(),
      });
      mockTransformProviderResponse.mockReturnValue(mockCountTokensResponse);

      const priorai = new Priorai(config);
      const result = await priorai.messages.countTokens(countTokensParams);

      expect(result).toEqual(mockCountTokensResponse);
    });

    it('uses messagesTargets instead of default targets', async () => {
      await setupMocks();
      const messagesTargets = [{ provider: 'anthropic', apiKey: 'anthropic-key' }];
      const config: PrioraiConfig = {
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

      const priorai = new Priorai(config);
      await priorai.messages.countTokens(countTokensParams);

      // buildProviderRequest should receive target from messagesTargets
      const { buildProviderRequest } = await import('../../src/core/providerRequest');
      expect(buildProviderRequest).toHaveBeenCalledWith(
        countTokensParams,
        'anthropic',
        messagesTargets[0],
        'messagesCountTokens',
      );
    });

    it('throws error when request fails', async () => {
      await setupMocks();
      const config: PrioraiConfig = {
        strategy: 'single',
        targets: [{ provider: 'anthropic', apiKey: 'key-1' }],
      };

      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Unauthorized' } }),
        headers: new Headers(),
      });

      const priorai = new Priorai(config);
      await expect(priorai.messages.countTokens(countTokensParams)).rejects.toThrow('HTTP 401');
    });
  });
});
