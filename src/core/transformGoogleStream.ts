import type { ChatCompletionChunk } from './types/streaming';
import { parseSSEStream, parseSSEDataMultiple } from './sseParser';
import { getSplitPattern, getFallbackChunkId } from './streamUtils';

interface GoogleStreamState {
  containsChainOfThoughtMessage: boolean;
}

function transformFinishReason(
  reason: string | null,
  strictOpenAiCompliance?: boolean
): string | null {
  if (!reason) return 'stop';
  if (!strictOpenAiCompliance) return reason;

  const mapping: Record<string, string> = {
    1: 'stop',
    2: 'length',
    3: 'stop',
    4: 'content_filter',
  };
  return mapping[reason] || 'stop';
}

function googleStreamTransform(
  chunk: string,
  fallbackId: string,
  streamState: GoogleStreamState,
  strictOpenAiCompliance?: boolean,
  provider?: string
): string | undefined {
  streamState.containsChainOfThoughtMessage =
    streamState?.containsChainOfThoughtMessage ?? false;

  let trimmed = chunk.trim();

  if (trimmed.startsWith('[')) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith(',')) {
    trimmed = trimmed.slice(0, trimmed.length - 1);
  }
  if (trimmed.endsWith(']')) {
    trimmed = trimmed.slice(0, trimmed.length - 2);
  }
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

  let usageMetadata: any;
  if (parsedChunk.usageMetadata) {
    usageMetadata = {
      prompt_tokens: parsedChunk.usageMetadata.promptTokenCount,
      completion_tokens: parsedChunk.usageMetadata.candidatesTokenCount,
      total_tokens: parsedChunk.usageMetadata.totalTokenCount,
    };
  }

  const contentBlocks: any[] = [];
  let content = '';

  if (parsedChunk.candidates) {
    for (const generation of parsedChunk.candidates) {
      const finishReason = generation.finishReason
        ? transformFinishReason(generation.finishReason.toString(), strictOpenAiCompliance)
        : null;

      if (generation.content?.parts) {
        for (const part of generation.content.parts) {
          if (part.thought) {
            contentBlocks.push({
              index: 0,
              delta: { thinking: part.text },
            });
            streamState.containsChainOfThoughtMessage = true;
          } else if (part.text) {
            content += part.text ?? '';
            contentBlocks.push({
              index: streamState.containsChainOfThoughtMessage ? 1 : 0,
              delta: { text: part.text },
            });
          } else if (part.functionCall) {
            const functionCall = part.functionCall;
            return (
              `data: ${JSON.stringify({
                id: fallbackId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: parsedChunk.modelVersion || '',
                provider: provider,
                choices: [
                  {
                    delta: {
                      role: 'assistant',
                      tool_calls: [
                        {
                          index: 0,
                          id: `portkey-${crypto.randomUUID()}`,
                          type: 'function',
                          function: {
                            name: functionCall.name,
                            arguments: JSON.stringify(functionCall.args),
                          },
                        },
                      ],
                    },
                    index: generation.index ?? 0,
                    finish_reason: null,
                  },
                ],
              })}` + '\n\n'
            );
          } else if (part.inlineData) {
            const inlineData = part.inlineData;
            contentBlocks.push({
              index: streamState.containsChainOfThoughtMessage ? 1 : 0,
              delta: {
                type: 'image_url',
                image_url: {
                  url: `data:${inlineData.mimeType};base64,${inlineData.data}`,
                },
              },
            });
          }
        }
      }

      const message: any = {
        role: 'assistant',
        content: content,
      };

      if (!strictOpenAiCompliance && contentBlocks.length) {
        message.content_blocks = contentBlocks;
      }

      return (
        `data: ${JSON.stringify({
          id: fallbackId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: parsedChunk.modelVersion || '',
          provider: provider,
          choices: [
            {
              delta: message,
              index: generation.index ?? 0,
              finish_reason: finishReason,
            },
          ],
          ...(parsedChunk.usageMetadata?.candidatesTokenCount && {
            usage: usageMetadata,
          }),
        })}` + '\n\n'
      );
    }
  }

  return;
}

export function createGoogleStream(
  response: Response,
  provider: string,
  strictOpenAiCompliance: boolean = false
): ReadableStream<ChatCompletionChunk> {
  const splitPattern = getSplitPattern(provider);
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body.getReader();
  const streamState: GoogleStreamState = { containsChainOfThoughtMessage: false };

  const generator = parseSSEStream(
    reader,
    splitPattern,
    (chunk, fallbackId, state) =>
      googleStreamTransform(
        chunk,
        fallbackId,
        state as GoogleStreamState,
        strictOpenAiCompliance,
        provider
      ),
    fallbackId,
    streamState as unknown as Record<string, unknown>
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

export function isGoogleProvider(provider: string): boolean {
  return provider === 'google' || provider === 'vertex-ai';
}
