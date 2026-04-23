import type { ChatCompletionChunk } from './types/streaming';
import { parseSSEStream, parseSSEDataMultiple } from './sseParser';
import { getSplitPattern, getFallbackChunkId } from './streamUtils';

interface CohereStreamState {
  generation_id: string;
  lastIndex: number;
}

function transformFinishReason(
  reason: string | null,
  strictOpenAiCompliance?: boolean
): string | null {
  if (!reason) return 'stop';
  if (!strictOpenAiCompliance) return reason;

  const mapping: Record<string, string> = {
    COMPLETE: 'stop',
    MAX_TOKENS: 'length',
    STOP_SEQUENCE: 'stop',
    QUOTA_EXCEEDED: 'content_filter',
  };
  return mapping[reason] || 'stop';
}

function cohereStreamTransform(
  chunk: string,
  fallbackId: string,
  streamState: CohereStreamState,
  strictOpenAiCompliance?: boolean,
  provider?: string,
  model?: string
): string | undefined {
  let trimmed = chunk.trim();
  trimmed = trimmed.replace(/^event:.*[\r\n]*/, '');
  trimmed = trimmed.replace(/^data: /, '');
  trimmed = trimmed.trim();

  let parsedChunk: any;
  try {
    parsedChunk = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (parsedChunk.type === 'message-start') {
    streamState.generation_id = parsedChunk.id || fallbackId;
  }

  if (parsedChunk.type === 'message-end') {
    const prompt_tokens =
      parsedChunk.delta?.usage?.tokens?.input_tokens ??
      parsedChunk.delta?.usage?.billed_units?.input_tokens ??
      0;
    const completion_tokens =
      parsedChunk.delta?.usage?.tokens?.output_tokens ??
      parsedChunk.delta?.usage?.billed_units?.output_tokens ??
      0;
    const total_tokens = prompt_tokens + completion_tokens;

    return (
      `data: ${JSON.stringify({
        id: streamState.generation_id || fallbackId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model || '',
        provider: provider,
        choices: [
          {
            index: streamState.lastIndex,
            delta: {},
            logprobs: null,
            finish_reason: transformFinishReason(
              parsedChunk.delta?.finish_reason,
              strictOpenAiCompliance
            ),
          },
        ],
        usage: {
          completion_tokens,
          prompt_tokens,
          total_tokens,
        },
      })}` +
      '\n\n' +
      'data: [DONE]\n\n'
    );
  }

  if ('index' in parsedChunk && parsedChunk.index !== undefined) {
    streamState.lastIndex = parsedChunk.index ?? 0;
  }

  const textContent = parsedChunk.delta?.message?.content?.text ?? '';
  const toolCalls = parsedChunk.delta?.message?.tool_calls;

  return (
    `data: ${JSON.stringify({
      id: streamState.generation_id || fallbackId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model || '',
      provider: provider,
      system_fingerprint: null,
      choices: [
        {
          index: streamState.lastIndex,
          delta: {
            role: 'assistant',
            content: textContent,
            ...(toolCalls && { tool_calls: toolCalls }),
          },
          logprobs: null,
          finish_reason: null,
        },
      ],
    })}` + '\n\n'
  );
}

export function createCohereStream(
  response: Response,
  provider: string,
  model?: string,
  strictOpenAiCompliance: boolean = false
): ReadableStream<ChatCompletionChunk> {
  const splitPattern = getSplitPattern(provider, '/chat');
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body.getReader();
  const streamState: CohereStreamState = { generation_id: '', lastIndex: 0 };

  const generator = parseSSEStream(
    reader,
    splitPattern,
    (chunk, fallbackId, state) =>
      cohereStreamTransform(
        chunk,
        fallbackId,
        state as CohereStreamState,
        strictOpenAiCompliance,
        provider,
        model
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

export function isCohereProvider(provider: string): boolean {
  return provider === 'cohere';
}
