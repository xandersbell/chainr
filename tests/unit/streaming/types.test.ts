import { describe, it, expect } from 'vitest';
import type {
  ChatCompletionChunk,
  StreamUsage,
  ChatCompletionChunkChoice,
  ChatCompletionDelta,
  ChatCompletionToolCallDelta,
  ContentBlockDelta,
  AnthropicStreamState,
} from '../../../src/core/types/streaming';

describe('Streaming Types', () => {
  describe('ChatCompletionChunk', () => {
    it('has required fields', () => {
      const chunk: ChatCompletionChunk = {
        id: 'test-id',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [],
      };
      expect(chunk.id).toBe('test-id');
      expect(chunk.object).toBe('chat.completion.chunk');
      expect(chunk.created).toBe(1234567890);
      expect(chunk.model).toBe('gpt-4');
      expect(chunk.choices).toEqual([]);
    });

    it('has optional usage field', () => {
      const chunk: ChatCompletionChunk = {
        id: 'test-id',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };
      expect(chunk.usage?.prompt_tokens).toBe(10);
      expect(chunk.usage?.completion_tokens).toBe(20);
      expect(chunk.usage?.total_tokens).toBe(30);
    });

    it('has optional provider field', () => {
      const chunk: ChatCompletionChunk = {
        id: 'test-id',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [],
        provider: 'openai',
      };
      expect(chunk.provider).toBe('openai');
    });
  });

  describe('StreamUsage', () => {
    it('has optional token fields', () => {
      const usage: StreamUsage = {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      };
      expect(usage.prompt_tokens).toBe(10);
      expect(usage.completion_tokens).toBe(20);
      expect(usage.total_tokens).toBe(30);
    });

    it('has optional cache token fields', () => {
      const usage: StreamUsage = {
        prompt_tokens_details: { cached_tokens: 5 },
        cache_read_input_tokens: 3,
        cache_creation_input_tokens: 7,
      };
      expect(usage.prompt_tokens_details?.cached_tokens).toBe(5);
      expect(usage.cache_read_input_tokens).toBe(3);
      expect(usage.cache_creation_input_tokens).toBe(7);
    });
  });

  describe('ChatCompletionDelta', () => {
    it('has optional role and content', () => {
      const delta: ChatCompletionDelta = {
        role: 'assistant',
        content: 'Hello',
      };
      expect(delta.role).toBe('assistant');
      expect(delta.content).toBe('Hello');
    });

    it('has optional tool_calls', () => {
      const delta: ChatCompletionDelta = {
        tool_calls: [
          {
            index: 0,
            id: 'tool_1',
            type: 'function',
            function: { name: 'test', arguments: '{}' },
          },
        ],
      };
      expect(delta.tool_calls?.[0].index).toBe(0);
      expect(delta.tool_calls?.[0].function.name).toBe('test');
    });

    it('has optional content_blocks', () => {
      const delta: ChatCompletionDelta = {
        content_blocks: [
          { index: 0, delta: { text: 'Hello' } },
        ],
      };
      expect(delta.content_blocks?.[0].delta.text).toBe('Hello');
    });
  });

  describe('AnthropicStreamState', () => {
    it('has toolIndex and optional model', () => {
      const state: AnthropicStreamState = {
        toolIndex: 1,
        model: 'claude-3',
      };
      expect(state.toolIndex).toBe(1);
      expect(state.model).toBe('claude-3');
    });

    it('has optional usage', () => {
      const state: AnthropicStreamState = {
        toolIndex: -1,
        usage: {
          prompt_tokens: 100,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 20,
        },
      };
      expect(state.usage?.prompt_tokens).toBe(100);
      expect(state.usage?.cache_read_input_tokens).toBe(50);
    });
  });
});

import {
  PROVIDER_SPLIT_PATTERNS,
  OPENAI_COMPATIBLE_PROVIDERS,
  isOpenAICompatibleProvider,
} from '../../../src/core/types/streaming';

describe('Streaming Constants', () => {
  describe('PROVIDER_SPLIT_PATTERNS', () => {
    it('maps openai to double newline', () => {
      expect(PROVIDER_SPLIT_PATTERNS['openai']).toBe('\n\n');
    });

    it('maps perplexity to crlf', () => {
      expect(PROVIDER_SPLIT_PATTERNS['perplexity']).toBe('\r\n\r\n');
    });

    it('maps anthropic to newline', () => {
      expect(PROVIDER_SPLIT_PATTERNS['anthropic']).toBe('\n\n');
    });

    it('maps vertex-ai to crlf', () => {
      expect(PROVIDER_SPLIT_PATTERNS['vertex-ai']).toBe('\r\n\r\n');
    });
  });

  describe('OPENAI_COMPATIBLE_PROVIDERS', () => {
    it('contains expected providers', () => {
      expect(OPENAI_COMPATIBLE_PROVIDERS).toContain('openai');
      expect(OPENAI_COMPATIBLE_PROVIDERS).toContain('openrouter');
      expect(OPENAI_COMPATIBLE_PROVIDERS).toContain('together-ai');
      expect(OPENAI_COMPATIBLE_PROVIDERS).toContain('perplexity');
      expect(OPENAI_COMPATIBLE_PROVIDERS).toContain('groq');
      expect(OPENAI_COMPATIBLE_PROVIDERS).toContain('deepseek');
      expect(OPENAI_COMPATIBLE_PROVIDERS).toContain('mistral-ai');
      expect(OPENAI_COMPATIBLE_PROVIDERS).toContain('cohere');
    });
  });

  describe('isOpenAICompatibleProvider', () => {
    it('returns true for openai-compatible providers', () => {
      expect(isOpenAICompatibleProvider('openai')).toBe(true);
      expect(isOpenAICompatibleProvider('openrouter')).toBe(true);
      expect(isOpenAICompatibleProvider('together-ai')).toBe(true);
    });

    it('returns false for non-openai providers', () => {
      expect(isOpenAICompatibleProvider('anthropic')).toBe(false);
      expect(isOpenAICompatibleProvider('vertex-ai')).toBe(false);
      expect(isOpenAICompatibleProvider('google')).toBe(false);
    });

    it('returns false for unknown providers', () => {
      expect(isOpenAICompatibleProvider('unknown')).toBe(false);
    });
  });
});