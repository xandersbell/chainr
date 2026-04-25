import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBytezStream, isBytezProvider } from '../../../src/core/transformBytezStream';

describe('transformBytezStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isBytezProvider', () => {
    it('returns true for bytez', () => {
      expect(isBytezProvider('bytez')).toBe(true);
    });

    it('returns false for openai', () => {
      expect(isBytezProvider('openai')).toBe(false);
    });

    it('returns false for unknown', () => {
      expect(isBytezProvider('unknown')).toBe(false);
    });
  });

  describe('createBytezStream', () => {
    it('creates ReadableStream from mock Response', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBytezStream(mockResponse, 'bytez');
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('transforms text delta chunk', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n'),
          );
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBytezStream(mockResponse, 'bytez');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: [{ delta: { content: 'Hello' } }],
      });
    });

    it('handles DONE signal', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBytezStream(mockResponse, 'bytez');
      const reader = stream.getReader();

      const { done } = await reader.read();
      expect(done).toBe(true);
    });

    it('handles data: [DONE] format', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: data: [DONE]\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBytezStream(mockResponse, 'bytez');
      const reader = stream.getReader();

      const { done } = await reader.read();
      expect(done).toBe(true);
    });

    it('transforms usage metadata', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"model":"bytez-model","choices":[{"index":0,"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n'),
          );
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBytezStream(mockResponse, 'bytez');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    });

    it('skips empty chunks', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: \n\n'));
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"index":0,"delta":{"content":"Hello"}}]}\n\n'),
          );
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBytezStream(mockResponse, 'bytez');
      const reader = stream.getReader();

      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toMatchObject({
        choices: [{ delta: { content: 'Hello' } }],
      });
    });

    it('transforms finish_reason', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":"stop"}]}\n\n'),
          );
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBytezStream(mockResponse, 'bytez');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: [{ finish_reason: 'stop' }],
      });
    });
  });
});