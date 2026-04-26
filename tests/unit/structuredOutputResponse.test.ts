/**
 * Cross-provider structured output response consistency tests
 *
 * When response_format: { type: 'json_schema' } is used, each provider returns
 * structured JSON differently. These tests verify that each provider's response
 * transform normalizes structured output responses to OpenAI format, and that
 * the normalized outputs are consistent across providers.
 */
import { describe, expect, it } from 'vitest';
import { getAnthropicChatCompleteResponseTransform } from '../../src/providers/anthropic/chatComplete';
import { GoogleChatCompleteResponseTransform as GoogleAIChatCompleteResponseTransform } from '../../src/providers/google/chatComplete';
import { GoogleChatCompleteResponseTransform as GoogleVertexChatCompleteResponseTransform } from '../../src/providers/google-vertex-ai/chatComplete';
import type { ChatCompletionResponse } from '../../src/providers/types';

// The structured JSON payload every provider should surface identically
const STRUCTURED_JSON = '{"name":"Alice","age":30}';

// --- Mock provider responses for structured output ---

const anthropicResponse = {
  id: 'msg_123',
  type: 'message' as const,
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text: STRUCTURED_JSON }],
  model: 'claude-sonnet-4-20250514',
  stop_reason: 'end_turn' as const,
  usage: { input_tokens: 100, output_tokens: 50 },
};

const googleResponse = {
  candidates: [
    {
      content: {
        parts: [{ text: STRUCTURED_JSON }],
        role: 'model' as const,
      },
      finishReason: 'STOP' as const,
      index: 0,
    },
  ],
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 50,
    totalTokenCount: 150,
    thoughtsTokenCount: 0,
    cachedContentTokenCount: 0,
    promptTokensDetails: [],
    candidatesTokensDetails: [],
  },
  modelVersion: 'gemini-2.0-flash',
};

// --- Helpers ---

const emptyHeaders = new Headers();

function assertIsCompletionResponse(
  result: unknown,
): asserts result is ChatCompletionResponse {
  expect(result).toBeDefined();
  expect(result).toHaveProperty('choices');
}

// --- Tests ---

describe('Structured Output Response — Anthropic', () => {
  const transform = getAnthropicChatCompleteResponseTransform('anthropic');

  it('extracts structured JSON content in strict mode', () => {
    const result = transform(anthropicResponse, 200, emptyHeaders, true);
    assertIsCompletionResponse(result);

    expect(result.choices[0].message.content).toBe(STRUCTURED_JSON);
  });

  it('maps finish_reason to "stop" in strict mode', () => {
    const result = transform(anthropicResponse, 200, emptyHeaders, true);
    assertIsCompletionResponse(result);

    expect(result.choices[0].finish_reason).toBe('stop');
  });

  it('preserves provider finish_reason in non-strict mode', () => {
    const result = transform(anthropicResponse, 200, emptyHeaders, false);
    assertIsCompletionResponse(result);

    // Non-strict mode passes through the raw provider value
    expect(result.choices[0].finish_reason).toBe('end_turn');
  });

  it('sets role to assistant', () => {
    const result = transform(anthropicResponse, 200, emptyHeaders, true);
    assertIsCompletionResponse(result);

    expect(result.choices[0].message.role).toBe('assistant');
  });

  it('populates usage tokens', () => {
    const result = transform(anthropicResponse, 200, emptyHeaders, true);
    assertIsCompletionResponse(result);

    expect(result.usage.prompt_tokens).toBe(100);
    expect(result.usage.completion_tokens).toBe(50);
  });
});

describe('Structured Output Response — Google AI', () => {
  it('extracts structured JSON content in strict mode', () => {
    const result = GoogleAIChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    assertIsCompletionResponse(result);

    expect(result.choices[0].message.content).toBe(STRUCTURED_JSON);
  });

  it('maps finish_reason to "stop" in strict mode', () => {
    const result = GoogleAIChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    assertIsCompletionResponse(result);

    expect(result.choices[0].finish_reason).toBe('stop');
  });

  it('preserves provider finish_reason in non-strict mode', () => {
    const result = GoogleAIChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      false,
    );
    assertIsCompletionResponse(result);

    expect(result.choices[0].finish_reason).toBe('STOP');
  });

  it('sets role to assistant', () => {
    const result = GoogleAIChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    assertIsCompletionResponse(result);

    expect(result.choices[0].message.role).toBe('assistant');
  });

  it('populates usage tokens', () => {
    const result = GoogleAIChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    assertIsCompletionResponse(result);

    expect(result.usage.prompt_tokens).toBe(100);
    expect(result.usage.completion_tokens).toBe(50);
  });
});

describe('Structured Output Response — Google Vertex AI', () => {
  it('extracts structured JSON content in strict mode', () => {
    const result = GoogleVertexChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    assertIsCompletionResponse(result);

    expect(result.choices[0].message.content).toBe(STRUCTURED_JSON);
  });

  it('maps finish_reason to "stop" in strict mode', () => {
    const result = GoogleVertexChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    assertIsCompletionResponse(result);

    expect(result.choices[0].finish_reason).toBe('stop');
  });

  it('preserves provider finish_reason in non-strict mode', () => {
    const result = GoogleVertexChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      false,
    );
    assertIsCompletionResponse(result);

    expect(result.choices[0].finish_reason).toBe('STOP');
  });

  it('sets role to assistant', () => {
    const result = GoogleVertexChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    assertIsCompletionResponse(result);

    expect(result.choices[0].message.role).toBe('assistant');
  });

  it('populates usage tokens', () => {
    const result = GoogleVertexChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    assertIsCompletionResponse(result);

    expect(result.usage.prompt_tokens).toBe(100);
    expect(result.usage.completion_tokens).toBe(50);
  });
});

describe('Structured Output Response — Cross-provider consistency', () => {
  it('all providers produce identical content and finish_reason in strict mode', () => {
    const anthropicTransform =
      getAnthropicChatCompleteResponseTransform('anthropic');
    const anthropicResult = anthropicTransform(
      anthropicResponse,
      200,
      emptyHeaders,
      true,
    );
    const googleAIResult = GoogleAIChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    const vertexResult = GoogleVertexChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );

    assertIsCompletionResponse(anthropicResult);
    assertIsCompletionResponse(googleAIResult);
    assertIsCompletionResponse(vertexResult);

    // Content must be identical across all providers
    const expectedContent = STRUCTURED_JSON;
    expect(anthropicResult.choices[0].message.content).toBe(expectedContent);
    expect(googleAIResult.choices[0].message.content).toBe(expectedContent);
    expect(vertexResult.choices[0].message.content).toBe(expectedContent);

    // finish_reason must normalize to 'stop' in strict mode
    expect(anthropicResult.choices[0].finish_reason).toBe('stop');
    expect(googleAIResult.choices[0].finish_reason).toBe('stop');
    expect(vertexResult.choices[0].finish_reason).toBe('stop');
  });

  it('all providers set role to assistant', () => {
    const anthropicTransform =
      getAnthropicChatCompleteResponseTransform('anthropic');
    const anthropicResult = anthropicTransform(
      anthropicResponse,
      200,
      emptyHeaders,
      true,
    );
    const googleAIResult = GoogleAIChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    const vertexResult = GoogleVertexChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );

    assertIsCompletionResponse(anthropicResult);
    assertIsCompletionResponse(googleAIResult);
    assertIsCompletionResponse(vertexResult);

    expect(anthropicResult.choices[0].message.role).toBe('assistant');
    expect(googleAIResult.choices[0].message.role).toBe('assistant');
    expect(vertexResult.choices[0].message.role).toBe('assistant');
  });

  it('all providers return object type "chat.completion"', () => {
    const anthropicTransform =
      getAnthropicChatCompleteResponseTransform('anthropic');
    const anthropicResult = anthropicTransform(
      anthropicResponse,
      200,
      emptyHeaders,
      true,
    );
    const googleAIResult = GoogleAIChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );
    const vertexResult = GoogleVertexChatCompleteResponseTransform(
      googleResponse,
      200,
      emptyHeaders,
      true,
    );

    assertIsCompletionResponse(anthropicResult);
    assertIsCompletionResponse(googleAIResult);
    assertIsCompletionResponse(vertexResult);

    expect(anthropicResult.object).toBe('chat.completion');
    expect(googleAIResult.object).toBe('chat.completion');
    expect(vertexResult.object).toBe('chat.completion');
  });
});
