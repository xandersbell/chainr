import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBedrockStream,
  isBedrockProvider,
} from '../../../src/core/transformBedrockStream';

function createAWSFrame(jsonPayload: object): Uint8Array {
  const payloadJson = JSON.stringify(jsonPayload);
  const payloadLen = Buffer.from(payloadJson).length;
  const totalLen = 12 + payloadLen + 4;
  const frame = Buffer.alloc(totalLen);
  frame.writeUInt32BE(totalLen, 0);
  frame.writeUInt32BE(0, 4);
  frame.writeUInt32BE(0, 8);
  Buffer.from(payloadJson).copy(frame, 12);
  frame.writeUInt32BE(0, totalLen - 4);
  return new Uint8Array(frame);
}

describe('transformBedrockStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isBedrockProvider', () => {
    it('returns true for bedrock', () => {
      expect(isBedrockProvider('bedrock')).toBe(true);
    });

    it('returns false for openai', () => {
      expect(isBedrockProvider('openai')).toBe(false);
    });

    it('returns false for google', () => {
      expect(isBedrockProvider('google')).toBe(false);
    });

    it('returns false for vertex-ai', () => {
      expect(isBedrockProvider('vertex-ai')).toBe(false);
    });
  });

  describe('createBedrockStream', () => {
    it('creates ReadableStream from mock AWS Response', async () => {
      const awsFrame = createAWSFrame({ delta: { text: 'hello' } });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(awsFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock');
      const reader = stream.getReader();

      const { done } = await reader.read();
      expect(done).toBe(false);
    });

    it('transforms text chunk to SSE format', async () => {
      const awsFrame = createAWSFrame({ delta: { text: 'hello' } });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(awsFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock', 'bedrock-model');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        id: expect.stringContaining('bedrock'),
        object: 'chat.completion.chunk',
        provider: 'bedrock',
        choices: expect.arrayContaining([
          expect.objectContaining({
            delta: expect.objectContaining({ content: 'hello' }),
          }),
        ]),
      });
    });

    it('transforms usage chunk and closes stream', async () => {
      const stopReasonFrame = createAWSFrame({ stopReason: 'end_turn' });
      const usageFrame = createAWSFrame({
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(stopReasonFrame);
          controller.enqueue(usageFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock');
      const reader = stream.getReader();

      const chunks: unknown[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[1].choices[0].finish_reason).toBeTruthy();
    });

    it('handles tool_use start chunk', async () => {
      const toolFrame = createAWSFrame({
        start: {
          toolUse: {
            toolUseId: 'tool-1',
            name: 'get_weather',
            input: '{"city":"Boston"}',
          },
        },
      });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(toolFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: expect.arrayContaining([
          expect.objectContaining({
            delta: expect.objectContaining({
              tool_calls: expect.arrayContaining([
                expect.objectContaining({
                  id: 'tool-1',
                  type: 'function',
                  function: expect.objectContaining({
                    name: 'get_weather',
                    arguments: '{"city":"Boston"}',
                  }),
                }),
              ]),
            }),
          }),
        ]),
      });
    });

    it('handles tool_use delta chunk', async () => {
      const toolDeltaFrame = createAWSFrame({
        delta: {
          toolUse: {
            toolUseId: 'tool-1',
            name: 'get_weather',
            input: '{"city":"Boston"}',
          },
        },
      });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(toolDeltaFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: expect.arrayContaining([
          expect.objectContaining({
            delta: expect.objectContaining({
              tool_calls: expect.arrayContaining([
                expect.objectContaining({
                  id: 'tool-1',
                  function: expect.objectContaining({ name: 'get_weather' }),
                }),
              ]),
            }),
          }),
        ]),
      });
    });

    it('handles reasoningContent delta', async () => {
      const reasoningFrame = createAWSFrame({
        delta: {
          reasoningContent: {
            text: 'thinking...',
            signature: 'sig123',
          },
        },
      });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(reasoningFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock', undefined, false);
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: expect.arrayContaining([
          expect.objectContaining({
            delta: expect.objectContaining({
              content_blocks: expect.arrayContaining([
                expect.objectContaining({
                  delta: expect.objectContaining({
                    thinking: 'thinking...',
                    signature: 'sig123',
                  }),
                }),
              ]),
            }),
          }),
        ]),
      });
    });

    it('maps stopReason end_turn to stop without strict', async () => {
      const stopReasonFrame = createAWSFrame({ stopReason: 'end_turn' });
      const usageFrame = createAWSFrame({
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(stopReasonFrame);
          controller.enqueue(usageFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock', undefined, false);
      const reader = stream.getReader();

      const chunks: unknown[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const finishChunk = chunks.find(
        (c: any) => c.choices?.[0]?.finish_reason !== null,
      );
      expect(finishChunk?.choices?.[0]?.finish_reason).toBe('end_turn');
    });

    it('maps stopReason max_tokens to length with strict', async () => {
      const stopReasonFrame = createAWSFrame({ stopReason: 'max_tokens' });
      const usageFrame = createAWSFrame({
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(stopReasonFrame);
          controller.enqueue(usageFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock', undefined, true);
      const reader = stream.getReader();

      const chunks: unknown[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const usageChunk = chunks[1];
      expect(usageChunk).toMatchObject({
        choices: expect.arrayContaining([
          expect.objectContaining({ finish_reason: 'length' }),
        ]),
      });
    });

    it('handles error chunk with message field', async () => {
      const errorFrame = createAWSFrame({ message: 'something went wrong' });
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(errorFrame);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock');
      const reader = stream.getReader();

      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toMatchObject({
        choices: expect.arrayContaining([
          expect.objectContaining({ finish_reason: 'error' }),
        ]),
      });
    });

    it('handles multiple chunks in single read', async () => {
      const frame1 = createAWSFrame({ delta: { text: 'hello' } });
      const frame2 = createAWSFrame({ delta: { text: ' world' } });
      const combined = new Uint8Array(frame1.length + frame2.length);
      combined.set(frame1, 0);
      combined.set(frame2, frame1.length);

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(combined);
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as unknown as Response;

      const stream = createBedrockStream(mockResponse, 'bedrock');
      const reader = stream.getReader();

      const chunks: unknown[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(2);
    });
  });
});