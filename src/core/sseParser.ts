import type { SplitPatternType, StreamTransformFn } from './types/streaming';

export { SplitPatternType, StreamTransformFn };

export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader,
  splitPattern: SplitPatternType,
  transformFunction: StreamTransformFn | undefined,
  fallbackChunkId: string,
  streamState: Record<string, unknown> = {}
): AsyncGenerator<string | undefined> {
  let buffer = '';
  const decoder = new TextDecoder();
  let isFirstChunk = true;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.length > 0 && transformFunction) {
        yield transformFunction(buffer, fallbackChunkId, streamState);
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (buffer.split(splitPattern).length > 1) {
      const parts = buffer.split(splitPattern);
      const lastPart = parts.pop() ?? '';

      for (const part of parts) {
        if (part.length > 0) {
          if (isFirstChunk) {
            isFirstChunk = false;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }

          if (transformFunction) {
            const transformed = transformFunction(part, fallbackChunkId, streamState);
            if (transformed !== undefined) {
              yield transformed;
            }
          } else {
            yield part + splitPattern;
          }
        }
      }

      buffer = lastPart;
    }
  }
}

export function createReadableStreamFromGenerator(
  generator: AsyncGenerator<string | undefined>
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          if (chunk) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

export function parseSSEData<T>(data: string): T | null {
  const trimmed = data.trim();
  if (trimmed === '[DONE]' || trimmed === 'data: [DONE]') {
    return null;
  }
  if (trimmed.startsWith('data: ')) {
    return JSON.parse(trimmed.slice(6)) as T;
  }
  return JSON.parse(trimmed) as T;
}

export function isStreamDone(data: string): boolean {
  return data.trim() === '[DONE]';
}