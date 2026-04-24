import type { ChatCompletionChunk } from './types/streaming';
import { parseSSEStream, parseSSEDataMultiple } from './sseParser';
import { getSplitPattern, getFallbackChunkId } from './streamUtils';

function openrouterStreamTransform(
  chunk: string,
  fallbackId: string,
  _streamState: Record<string, unknown>,
  strictOpenAiCompliance?: boolean,
  provider?: string,
  model?: string
): string | undefined {
  let trimmed = chunk.trim();
  trimmed = trimmed.replace(/^data: /, '');
  trimmed = trimmed.trim();

  if (trimmed === '[DONE]') {
    return `data: ${trimmed}\n\n`;
  }

  if (trimmed.includes('OPENROUTER PROCESSING')) {
    return JSON.stringify({
      id: `${Date.now()}`,
      model: model || '',
      object: 'chat.completion.chunk',
      created: Date.now(),
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: '' },
          finish_reason: null,
        },
      ],
    }) + '\n\n';
  }

  let parsedChunk: any;
  try {
    parsedChunk = JSON.parse(trimmed);
  } catch {
    return;
  }

  const contentBlocks: any[] = [];
  if (!strictOpenAiCompliance) {
    if (parsedChunk.choices?.[0]?.delta?.reasoning) {
      contentBlocks.push({
        index: parsedChunk.choices?.[0]?.index,
        delta: {
          thinking: parsedChunk.choices?.[0]?.delta?.reasoning,
        },
      });
    }
    if (parsedChunk.choices?.[0]?.delta?.content) {
      contentBlocks.push({
        index: parsedChunk.choices?.[0]?.index,
        delta: {
          text: parsedChunk.choices?.[0]?.delta?.content,
        },
      });
    }
  }

  return JSON.stringify({
    id: parsedChunk.id || fallbackId,
    object: parsedChunk.object || 'chat.completion.chunk',
    created: parsedChunk.created || Math.floor(Date.now() / 1000),
    model: parsedChunk.model || model || '',
    provider: provider,
    choices: [
      {
        index: parsedChunk.choices?.[0]?.index ?? 0,
        delta: {
          ...parsedChunk.choices?.[0]?.delta,
          ...(contentBlocks.length && { content_blocks: contentBlocks }),
        },
        finish_reason: parsedChunk.choices?.[0]?.finish_reason ?? null,
      },
    ],
    ...(parsedChunk.usage && { usage: parsedChunk.usage }),
  }) + '\n\n';
}

export function createOpenRouterStream(
  response: Response,
  provider: string,
  model?: string,
  strictOpenAiCompliance: boolean = false
): ReadableStream<ChatCompletionChunk> {
  const splitPattern = getSplitPattern(provider);
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body!.getReader();

  const generator = parseSSEStream(
    reader,
    splitPattern,
    (chunk, fallbackId, state) =>
      openrouterStreamTransform(
        chunk,
        fallbackId,
        state,
        strictOpenAiCompliance,
        provider,
        model
      ),
    fallbackId,
    {}
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
    }
  });
}

export function isOpenRouterProvider(provider: string): boolean {
  return provider === 'openrouter';
}
