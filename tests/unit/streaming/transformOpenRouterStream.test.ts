import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenRouterStream, isOpenRouterProvider } from '../../../src/core/transformOpenRouterStream';

describe('transformOpenRouterStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isOpenRouterProvider', () => {
    it('returns true for openrouter', () => {
      expect(isOpenRouterProvider('openrouter')).toBe(true);
    });

    it('returns false for openai', () => {
      expect(isOpenRouterProvider('openai')).toBe(false);
    });

    it('returns false for unknown', () => {
      expect(isOpenRouterProvider('unknown')).toBe(false);
    });
  });

  describe('createOpenRouterStream', () => {
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

      const stream = createOpenRouterStream(mockResponse, 'openrouter');
      expect(stream).toBeInstanceOf(ReadableStream);
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

      const stream = createOpenRouterStream(mockResponse, 'openrouter');
      const reader = stream.getReader();

      const { done } = await reader.read();
      expect(done).toBe(true);
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

      const stream = createOpenRouterStream(mockResponse, 'openrouter');
      const reader = stream.getReader();

      const { done } = await reader.read();
      expect(done).toBe(true);
    });
  });
});