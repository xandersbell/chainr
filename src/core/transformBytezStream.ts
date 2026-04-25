import { parseSSEDataMultiple, parseSSEStream } from './sseParser';
import { getFallbackChunkId } from './streamUtils';
import type { ChatCompletionChunk } from './types/streaming';

function bytezStreamTransform(
  chunk: string,
  fallbackId: string,
  _streamState: Record<string, unknown>,
  _strictOpenAiCompliance?: boolean,
  provider?: string,
): string | undefined {
  let trimmed = chunk.trim();
  if (!trimmed) return;

  trimmed = trimmed.replace(/^data: /, '');
  trimmed = trimmed.trim();

  if (trimmed === '[DONE]' || trimmed === 'data: [DONE]') {
    return `data: [DONE]\n\n`;
  }

  let parsedChunk: any;
  try {
    parsedChunk = JSON.parse(trimmed);
  } catch {
    return;
  }

  const content = parsedChunk.choices?.[0]?.delta?.content || '';

  return `data: ${JSON.stringify({
    id: fallbackId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: parsedChunk.model || '',
    provider: provider,
    choices: [
      {
        index: parsedChunk.choices?.[0]?.index ?? 0,
        delta: {
          role: 'assistant',
          content,
        },
        finish_reason: parsedChunk.choices?.[0]?.finish_reason || null,
      },
    ],
    ...(parsedChunk.usage && { usage: parsedChunk.usage }),
  })}\n\n`;
}

export function createBytezStream(
  response: Response,
  provider: string,
  strictOpenAiCompliance: boolean = false,
): ReadableStream<ChatCompletionChunk> {
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body!.getReader();

  const generator = parseSSEStream(
    reader,
    ' ',
    (chunk, fallbackId, state) =>
      bytezStreamTransform(chunk, fallbackId, state, strictOpenAiCompliance, provider),
    fallbackId,
    {},
  );

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunkStr of generator) {
          if (chunkStr) {
            const parsedChunks = parseSSEDataMultiple<ChatCompletionChunk>(chunkStr);
            for (const parsed of parsedChunks) {
              if (parsed) {
                controller.enqueue(parsed);
              }
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function isBytezProvider(provider: string): boolean {
  return provider === 'bytez';
}
