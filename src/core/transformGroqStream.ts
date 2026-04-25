import { parseSSEDataMultiple, parseSSEStream } from './sseParser';
import { getFallbackChunkId, getSplitPattern } from './streamUtils';
import type { ChatCompletionChunk } from './types/streaming';

function groqStreamTransform(
  chunk: string,
  fallbackId: string,
  _streamState: Record<string, unknown>,
  _strictOpenAiCompliance?: boolean,
  provider?: string,
): string | undefined {
  let trimmed = chunk.trim();
  trimmed = trimmed.replace(/^data: /, '');
  trimmed = trimmed.trim();

  if (trimmed === '[DONE]') {
    return `data: ${trimmed}\n\n`;
  }

  let parsedChunk: any;
  try {
    parsedChunk = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (parsedChunk['x_groq']?.usage) {
    return (
      'data: ' +
      JSON.stringify({
        id: parsedChunk.id || fallbackId,
        object: parsedChunk.object || 'chat.completion.chunk',
        created: parsedChunk.created || Math.floor(Date.now() / 1000),
        model: parsedChunk.model || '',
        provider: provider,
        choices: [
          {
            index: parsedChunk.choices?.[0]?.index ?? 0,
            delta: {},
            logprobs: null,
            finish_reason: parsedChunk.choices?.[0]?.finish_reason ?? null,
          },
        ],
        usage: {
          prompt_tokens: parsedChunk['x_groq'].usage.prompt_tokens || 0,
          completion_tokens: parsedChunk['x_groq'].usage.completion_tokens || 0,
          total_tokens: parsedChunk['x_groq'].usage.total_tokens || 0,
        },
      }) + '\n\n'
    );
  }

  return (
    'data: ' +
    JSON.stringify({
      id: parsedChunk.id || fallbackId,
      object: parsedChunk.object || 'chat.completion.chunk',
      created: parsedChunk.created || Math.floor(Date.now() / 1000),
      model: parsedChunk.model || '',
      provider: provider,
      choices:
        parsedChunk.choices && parsedChunk.choices.length > 0
          ? [
              {
                index: parsedChunk.choices[0].index || 0,
                delta: {
                  role: 'assistant',
                  content: parsedChunk.choices[0].delta?.content || '',
                  tool_calls: parsedChunk.choices[0].delta?.tool_calls || [],
                },
                logprobs: null,
                finish_reason: parsedChunk.choices[0].finish_reason || null,
              },
            ]
          : [],
      usage: parsedChunk.usage
        ? {
            prompt_tokens: parsedChunk.usage.prompt_tokens || 0,
            completion_tokens: parsedChunk.usage.completion_tokens || 0,
            total_tokens: parsedChunk.usage.total_tokens || 0,
          }
        : undefined,
    }) + '\n\n'
  );
}

export function createGroqStream(
  response: Response,
  provider: string,
  strictOpenAiCompliance: boolean = false,
): ReadableStream<ChatCompletionChunk> {
  const splitPattern = getSplitPattern(provider);
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body!.getReader();

  const generator = parseSSEStream(
    reader,
    splitPattern,
    (chunk, fallbackId, state) =>
      groqStreamTransform(chunk, fallbackId, state, strictOpenAiCompliance, provider),
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

export function isGroqProvider(provider: string): boolean {
  return provider === 'groq';
}
