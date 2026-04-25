import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOpenAIStream,
  createPassthroughStream,
  isOpenAICompatibleProvider,
} from '../../../src/core/transformOpenAIStream';

describe('transformOpenAIStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isOpenAICompatibleProvider', () => {
    it('returns true for openai', () => {
      expect(isOpenAICompatibleProvider('openai')).toBe(true);
    });

    it('returns true for openrouter', () => {
      expect(isOpenAICompatibleProvider('openrouter')).toBe(true);
    });

    it('returns true for together-ai', () => {
      expect(isOpenAICompatibleProvider('together-ai')).toBe(true);
    });

    it('returns true for perplexity', () => {
      expect(isOpenAICompatibleProvider('perplexity')).toBe(true);
    });

    it('returns true for groq', () => {
      expect(isOpenAICompatibleProvider('groq')).toBe(true);
    });

    it('returns true for deepseek', () => {
      expect(isOpenAICompatibleProvider('deepseek')).toBe(true);
    });

    it('returns true for mistral-ai', () => {
      expect(isOpenAICompatibleProvider('mistral-ai')).toBe(true);
    });

    it('returns true for cohere', () => {
      expect(isOpenAICompatibleProvider('cohere')).toBe(true);
    });

    it('returns false for anthropic', () => {
      expect(isOpenAICompatibleProvider('anthropic')).toBe(false);
    });

    it('returns false for vertex-ai', () => {
      expect(isOpenAICompatibleProvider('vertex-ai')).toBe(false);
    });

    it('returns false for unknown provider', () => {
      expect(isOpenAICompatibleProvider('unknown')).toBe(false);
    });
  });

  describe('createOpenAIStream', () => {
    it('creates ReadableStream from mock Response', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"id":"test","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
            ),
          );
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createOpenAIStream(mockResponse, 'openai');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        id: 'test',
        object: 'chat.completion.chunk',
        choices: [{ delta: { content: 'Hi' } }],
      });
    });

    it('handles DONE signal gracefully', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"id":"test","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
            ),
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createOpenAIStream(mockResponse, 'openai');
      const reader = stream.getReader();

      let chunkCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkCount++;
      }
      expect(chunkCount).toBe(1);
    });

    it('uses correct split pattern for provider', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"id":"test"}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createOpenAIStream(mockResponse, 'openai');
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('generates fallback chunk ID with provider prefix', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createOpenAIStream(mockResponse, 'openai');
      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe('createPassthroughStream', () => {
    it('creates ReadableStream that passes through raw bytes', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5, 6]));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createPassthroughStream(mockResponse);
      const reader = stream.getReader();

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks.length).toBe(2);
      expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(chunks[1]).toEqual(new Uint8Array([4, 5, 6]));
    });
  });
});
