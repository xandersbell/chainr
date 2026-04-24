import type { ChatCompletionChunk, AnthropicStreamState } from './types/streaming';
import { parseSSEStream, parseSSEDataMultiple } from './sseParser';
import { getSplitPattern, getFallbackChunkId } from './streamUtils';

function transformFinishReason(
  reason: string | null,
  strictOpenAiCompliance?: boolean
): string | null {
  if (!reason) return 'stop';
  if (!strictOpenAiCompliance) return reason;

  const mapping: Record<string, string> = {
    end_turn: 'stop',
    max_tokens: 'length',
    stop_sequence: 'stop',
  };
  return mapping[reason] || 'stop';
}

function anthropicStreamTransform(
  chunk: string,
  fallbackId: string,
  streamState: AnthropicStreamState,
  strictOpenAiCompliance?: boolean,
  provider?: string
): string | undefined {
  let trimmed = chunk.trim();

  if (
    trimmed.startsWith('event: ping') ||
    trimmed.startsWith('event: content_block_stop')
  ) {
    return;
  }

  if (trimmed.startsWith('event: message_stop')) {
    return 'data: [DONE]\n\n';
  }

  trimmed = trimmed.replace(/^event: content_block_delta[\r\n]*/, '');
  trimmed = trimmed.replace(/^event: content_block_start[\r\n]*/, '');
  trimmed = trimmed.replace(/^event: message_delta[\r\n]*/, '');
  trimmed = trimmed.replace(/^event: message_start[\r\n]*/, '');
  trimmed = trimmed.replace(/^event: error[\r\n]*/, '');
  trimmed = trimmed.replace(/^data: /, '');
  trimmed = trimmed.trim();

  const parsedChunk = JSON.parse(trimmed);

  if (parsedChunk.type === 'error' && parsedChunk.error) {
    return (
      `data: ${JSON.stringify({
        id: fallbackId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: '',
        provider: provider,
        choices: [
          {
            finish_reason: parsedChunk.error.type,
            delta: {
              content: '',
            },
            index: 0,
            logprobs: null,
          },
        ],
      })}` +
      '\n\n' +
      'data: [DONE]\n\n'
    );
  }

  if (parsedChunk.type === 'message_start' && parsedChunk.message) {
    streamState.model = parsedChunk.message.model ?? '';
    streamState.usage = {
      prompt_tokens: parsedChunk.message.usage?.input_tokens ?? 0,
      cache_read_input_tokens: parsedChunk.message.usage?.cache_read_input_tokens,
      cache_creation_input_tokens:
        parsedChunk.message.usage?.cache_creation_input_tokens,
    };
    return (
      `data: ${JSON.stringify({
        id: fallbackId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: streamState.model,
        provider: provider,
        choices: [
          {
            delta: {
              content: '',
              role: 'assistant',
            },
            index: 0,
            logprobs: null,
            finish_reason: null,
          },
        ],
      })}` + '\n\n'
    );
  }

  if (parsedChunk.type === 'message_delta' && parsedChunk.usage) {
    const totalTokens =
      (streamState.usage?.prompt_tokens ?? 0) +
      (streamState.usage?.cache_creation_input_tokens ?? 0) +
      (streamState.usage?.cache_read_input_tokens ?? 0) +
      (parsedChunk.usage.output_tokens ?? 0);

    return (
      `data: ${JSON.stringify({
        id: fallbackId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: streamState.model,
        provider: provider,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: transformFinishReason(
              parsedChunk.delta?.stop_reason,
              strictOpenAiCompliance
            ),
          },
        ],
        usage: {
          ...streamState.usage,
          completion_tokens: parsedChunk.usage.output_tokens,
          total_tokens: totalTokens,
          prompt_tokens_details: {
            cached_tokens: streamState.usage?.cache_read_input_tokens ?? 0,
          },
        },
      })}` + '\n\n'
    );
  }

  const textContent = parsedChunk.delta?.text;
  const toolCalls: Array<{
    index: number;
    id?: string;
    type: 'function';
    function: { name?: string; arguments?: string };
  }> = [];

  if (streamState.toolIndex === undefined) {
    streamState.toolIndex = -1;
  }

  const isToolBlockStart: boolean =
    parsedChunk.type === 'content_block_start' &&
    parsedChunk.content_block?.type === 'tool_use';
  const isToolBlockDelta: boolean =
    parsedChunk.type === 'content_block_delta' &&
    parsedChunk.delta?.partial_json !== undefined;

  if (isToolBlockStart && parsedChunk.content_block) {
    streamState.toolIndex = streamState.toolIndex + 1;
  }

  if (isToolBlockStart && parsedChunk.content_block) {
    toolCalls.push({
      index: streamState.toolIndex,
      id: parsedChunk.content_block.id,
      type: 'function',
      function: {
        name: parsedChunk.content_block.name,
        arguments: '',
      },
    });
  } else if (isToolBlockDelta) {
    toolCalls.push({
      index: streamState.toolIndex,
      type: 'function' as const,
      function: {
        arguments: parsedChunk.delta.partial_json,
      },
    });
  }

  const contentBlockObject = {
    index: parsedChunk.index ?? 0,
    delta: parsedChunk.delta ?? parsedChunk.content_block ?? {},
  };
  delete (contentBlockObject.delta as any).type;

  const shouldSendContentBlocks = !strictOpenAiCompliance && !toolCalls.length;

  return (
    `data: ${JSON.stringify({
      id: fallbackId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: streamState.model,
      provider: provider,
      choices: [
        {
          delta: {
            content: textContent ?? null,
            tool_calls: toolCalls.length ? toolCalls : undefined,
            ...(shouldSendContentBlocks && { content_blocks: [contentBlockObject] }),
          },
          index: parsedChunk.index ?? 0,
          logprobs: null,
          finish_reason: null,
        },
      ],
    })}` + '\n\n'
  );
}

export function createAnthropicStream(
  response: Response,
  provider: string,
  strictOpenAiCompliance: boolean = false
): ReadableStream<ChatCompletionChunk> {
  const splitPattern = getSplitPattern(provider, '/v1/messages');
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body!.getReader();
  const streamState: AnthropicStreamState = { toolIndex: -1 };

  const generator = parseSSEStream(
    reader,
    splitPattern,
    (chunk, fallbackId, state) =>
      anthropicStreamTransform(
        chunk,
        fallbackId,
        state as unknown as AnthropicStreamState,
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

export function isAnthropicProvider(provider: string): boolean {
  return provider === 'anthropic';
}
