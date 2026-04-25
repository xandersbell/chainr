import type { ChatCompletionChunk } from './types/streaming';
import { parseSSEStream, parseSSEDataMultiple } from './sseParser';
import { getSplitPattern, getFallbackChunkId } from './streamUtils';
import { OPENAI_COMPATIBLE_PROVIDERS } from './types/streaming';

export { OPENAI_COMPATIBLE_PROVIDERS };

export function isOpenAICompatibleProvider(provider: string): boolean {
  return OPENAI_COMPATIBLE_PROVIDERS.includes(provider);
}

function openAiStreamTransform(
  chunk: string,
  _fallbackId: string,
  _streamState: Record<string, unknown>
): string | undefined {
  const trimmed = chunk.trim();
  if (trimmed === '[DONE]') {
    return undefined;
  }
  return chunk;
}

/**
 * Azure OpenAI SSE streams may concatenate multiple chunks in a single send
 * Without delay, client-side parsing errors can occur; aligned with Portkey's isSleepTimeRequired
 */
function isAzureProvider(provider: string): boolean {
  return provider === 'azure-openai' || provider === 'azure-ai';
}

export function createOpenAIStream(
  response: Response,
  provider: string
): ReadableStream<ChatCompletionChunk> {
  const splitPattern = getSplitPattern(provider);
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body!.getReader();
  const needsChunkDelay = isAzureProvider(provider);

  const generator = parseSSEStream(
    reader,
    splitPattern,
    openAiStreamTransform,
    fallbackId,
    {}
  );

  let isFirstChunk = true;

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunkStr of generator) {
          if (chunkStr) {
            // Delay 25ms on first chunk (all providers), 1ms on subsequent Azure chunks
            if (isFirstChunk) {
              await new Promise(resolve => setTimeout(resolve, 25));
              isFirstChunk = false;
            } else if (needsChunkDelay) {
              await new Promise(resolve => setTimeout(resolve, 1));
            }
            const parsedChunks = parseSSEDataMultiple<ChatCompletionChunk>(chunkStr);
            for (const parsed of parsedChunks) {
              controller.enqueue(parsed);
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

export function createPassthroughStream(response: Response): ReadableStream<Uint8Array> {
  const reader = response.body!.getReader();
  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}