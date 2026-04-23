import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAnthropicProvider, createAnthropicStream } from '../../../src/core/transformAnthropicStream';

describe('transformAnthropicStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAnthropicProvider', () => {
    it('returns true for anthropic', () => {
      expect(isAnthropicProvider('anthropic')).toBe(true);
    });

    it('returns false for openai', () => {
      expect(isAnthropicProvider('openai')).toBe(false);
    });

    it('returns false for unknown', () => {
      expect(isAnthropicProvider('unknown')).toBe(false);
    });
  });

  describe('createAnthropicStream', () => {
    it('creates ReadableStream from mock Response', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant"}}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createAnthropicStream(mockResponse, 'anthropic');
      const reader = stream.getReader();

      const { done } = await reader.read();
      expect(done).toBe(false);
    });

    it('transforms message_start event to initial chunk with role', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","model":"claude-3"}}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createAnthropicStream(mockResponse, 'anthropic');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: [{ delta: { role: 'assistant' } }]
      });
    });

    it('transforms content_block_delta text event to chunk with content', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createAnthropicStream(mockResponse, 'anthropic');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: [{ delta: { content: 'Hello' } }]
      });
    });

    it('transforms message_delta event with finish_reason', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":10}}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createAnthropicStream(mockResponse, 'anthropic');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: [{ finish_reason: 'end_turn' }]
      });
    });

    it('skips ping event', async () => {
      let chunksReceived = 0;
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: ping\ndata: {}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createAnthropicStream(mockResponse, 'anthropic');
      const reader = stream.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
        chunksReceived++;
      }
      expect(chunksReceived).toBe(0);
    });

    it('skips content_block_stop event', async () => {
      let chunksReceived = 0;
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: content_block_stop\ndata: {"index":0}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createAnthropicStream(mockResponse, 'anthropic');
      const reader = stream.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
        chunksReceived++;
      }
      expect(chunksReceived).toBe(0);
    });

    it('handles message_stop event with DONE signal', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: message_stop\ndata: {}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createAnthropicStream(mockResponse, 'anthropic');
      const reader = stream.getReader();

      let chunksReceived = 0;
      while (true) {
        const { done } = await reader.read();
        if (done) break;
        chunksReceived++;
      }
      expect(chunksReceived).toBe(0);
    });

    it('handles error events', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: error\ndata: {"type":"error","error":{"type":"rate_limit_error","message":"Rate limit exceeded"}}\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createAnthropicStream(mockResponse, 'anthropic');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
    });
  });
});