import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCohereStream, isCohereProvider } from '../../../src/core/transformCohereStream';

describe('transformCohereStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isCohereProvider', () => {
    it('returns true for cohere', () => {
      expect(isCohereProvider('cohere')).toBe(true);
    });

    it('returns false for openai', () => {
      expect(isCohereProvider('openai')).toBe(false);
    });

    it('returns false for unknown', () => {
      expect(isCohereProvider('unknown')).toBe(false);
    });
  });

  describe('createCohereStream', () => {
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

      const stream = createCohereStream(mockResponse, 'cohere');
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('returns stream that can be read from', async () => {
      const chunks = [];
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'event: message_end\ndata: {"type":"message_end","delta":{"usage":{"tokens":{"input_tokens":10,"output_tokens":20}},"finish_reason":"COMPLETE"}}\n\n',
            ),
          );
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createCohereStream(mockResponse, 'cohere');
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('handles empty stream', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createCohereStream(mockResponse, 'cohere');
      const reader = stream.getReader();

      const { done } = await reader.read();
      expect(done).toBe(true);
    });
  });
});