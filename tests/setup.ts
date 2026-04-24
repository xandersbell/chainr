import type { RetryResult, TransformResult } from '../src/core/types';

export function createMockFetch(
  mockResponse: Record<string, unknown>,
  ok: boolean = true
): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: vi.fn().mockResolvedValue(mockResponse),
    headers: new Map([['content-type', 'application/json']]),
  }) as unknown as typeof fetch;
}

export function createMockRetryRequest(
  success: boolean,
  responseData?: Record<string, unknown>,
  errorMsg?: string
): typeof import('../src/core/RetryHandler').retryRequest {
  const result: RetryResult = {
    success,
    response: responseData || { status: 200, data: { id: 'test', choices: [] } },
    error: errorMsg,
  };
  return vi.fn().mockResolvedValue(result) as unknown as typeof import('../src/core/RetryHandler').retryRequest;
}

export function createMockBuildProviderRequest(
  result: TransformResult
): typeof import('../src/core/providerRequest').buildProviderRequest {
  return vi.fn().mockResolvedValue(result) as unknown as typeof import('../src/core/providerRequest').buildProviderRequest;
}

export function mockMathRandom(value: number): () => void {
  let originalRandom: typeof Math.random;
  beforeEach(() => {
    originalRandom = Math.random;
    Math.random = vi.fn().mockReturnValue(value);
  });
  afterEach(() => {
    Math.random = originalRandom;
  });
  return () => {
    Math.random = originalRandom;
  };
}

export function createMockResponse(status: number, data: unknown): Record<string, unknown> {
  return { status, data };
}

export function createSuccessChatCompletionResponse(
  content: string = 'Hello, world!'
): Record<string, unknown> {
  return {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };
}

export function createAnthropicResponse(
  content: string = 'Hello, world!'
): Record<string, unknown> {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    model: 'claude-3-5-sonnet-20241022',
    content: [
      {
        type: 'text',
        text: content,
      },
    ],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 10,
      output_tokens: 20,
    },
  };
}

export function createVertexAIResponse(
  content: string = 'Hello, world!'
): Record<string, unknown> {
  return {
    candidates: [
      {
        content: [
          {
            parts: [
              {
                text: content,
              },
            ],
          },
        ],
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      totalTokenCount: 30,
    },
    modelVersion: 'gemini-2.0-flash',
  };
}