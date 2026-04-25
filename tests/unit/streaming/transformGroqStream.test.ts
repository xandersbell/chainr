import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGroqStream, isGroqProvider } from '../../../src/core/transformGroqStream';
import type { ChatCompletionChunk } from '../../../src/core/types/streaming';

// 辅助函数：构造 SSE 格式的 Response
function createSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return { body: stream } as unknown as Response;
}

// 辅助函数：读取所有 chunks
async function readAllChunks(stream: ReadableStream<ChatCompletionChunk>): Promise<ChatCompletionChunk[]> {
  const reader = stream.getReader();
  const chunks: ChatCompletionChunk[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe('transformGroqStream', () => {
  describe('isGroqProvider', () => {
    it('returns true for groq', () => {
      expect(isGroqProvider('groq')).toBe(true);
    });

    it('returns false for other providers', () => {
      expect(isGroqProvider('openai')).toBe(false);
      expect(isGroqProvider('anthropic')).toBe(false);
    });
  });

  describe('createGroqStream', () => {
    it('transforms a basic text chunk', async () => {
      const sseData = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n';
      const response = createSSEResponse([sseData]);

      const stream = createGroqStream(response, 'groq');
      const chunks = await readAllChunks(stream);

      expect(chunks.length).toBe(1);
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
      expect(chunks[0].model).toBe('llama-3.3-70b');
      expect(chunks[0].provider).toBe('groq');
    });

    it('transforms multiple text chunks', async () => {
      const chunk1 = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n';
      const chunk2 = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"role":"assistant","content":" world"},"finish_reason":null}]}\n\n';
      const response = createSSEResponse([chunk1, chunk2]);

      const stream = createGroqStream(response, 'groq');
      const chunks = await readAllChunks(stream);

      expect(chunks.length).toBe(2);
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
      expect(chunks[1].choices[0].delta.content).toBe(' world');
    });

    it('handles x_groq usage chunk', async () => {
      const usageChunk = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"x_groq":{"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}}\n\n';
      const response = createSSEResponse([usageChunk]);

      const stream = createGroqStream(response, 'groq');
      const chunks = await readAllChunks(stream);

      expect(chunks.length).toBe(1);
      expect(chunks[0].usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
      expect(chunks[0].choices[0].finish_reason).toBe('stop');
    });

    it('handles [DONE] signal', async () => {
      const textChunk = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n';
      const doneChunk = 'data: [DONE]\n\n';
      const response = createSSEResponse([textChunk, doneChunk]);

      const stream = createGroqStream(response, 'groq');
      const chunks = await readAllChunks(stream);

      // [DONE] should not produce a parsed chunk
      expect(chunks.length).toBe(1);
      expect(chunks[0].choices[0].delta.content).toBe('Hi');
    });

    it('handles tool calls', async () => {
      const toolChunk = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{}"}}]},"finish_reason":null}]}\n\n';
      const response = createSSEResponse([toolChunk]);

      const stream = createGroqStream(response, 'groq');
      const chunks = await readAllChunks(stream);

      expect(chunks.length).toBe(1);
      expect(chunks[0].choices[0].delta.tool_calls).toHaveLength(1);
      expect(chunks[0].choices[0].delta.tool_calls![0].function.name).toBe('get_weather');
    });

    it('handles finish_reason stop', async () => {
      const stopChunk = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n';
      const response = createSSEResponse([stopChunk]);

      const stream = createGroqStream(response, 'groq');
      const chunks = await readAllChunks(stream);

      expect(chunks.length).toBe(1);
      expect(chunks[0].choices[0].finish_reason).toBe('stop');
    });

    it('handles standard usage field (non x_groq)', async () => {
      const usageChunk = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1700000000,"model":"llama-3.3-70b","choices":[],"usage":{"prompt_tokens":8,"completion_tokens":3,"total_tokens":11}}\n\n';
      const response = createSSEResponse([usageChunk]);

      const stream = createGroqStream(response, 'groq');
      const chunks = await readAllChunks(stream);

      expect(chunks.length).toBe(1);
      expect(chunks[0].usage).toEqual({
        prompt_tokens: 8,
        completion_tokens: 3,
        total_tokens: 11,
      });
    });
  });
});
