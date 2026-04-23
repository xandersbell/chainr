import type { ChatCompletionChunk, AnthropicStreamState } from './types/streaming';
import { parseSSEStream, parseSSEData } from './sseParser';
import { getSplitPattern, getFallbackChunkId } from './streamUtils';

function transformFinishReason(reason: string | null): string | null {
  if (!reason) return null;
  const mapping: Record<string, string> = {
    end_turn: 'stop',
    max_tokens: 'length',
    stop_sequence: 'stop',
  };
  return mapping[reason] || reason;
}

function anthropicStreamTransform(
  chunk: string,
  fallbackId: string,
  streamState: AnthropicStreamState
): string | undefined {
  let trimmed = chunk.trim();

  if (trimmed.startsWith('event: ping') || trimmed.startsWith('event: content_block_stop')) {
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
    return `data: ${JSON.stringify({
      id: fallbackId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: '',
      choices: [{
        finish_reason: parsedChunk.error.type,
        delta: { content: '' },
        index: 0,
        logprobs: null,
      }],
    })}\n\n`;
  }

  if (parsedChunk.type === 'message_start' && parsedChunk.message) {
    streamState.model = parsedChunk.message.model ?? '';
    streamState.usage = {
      prompt_tokens: parsedChunk.message.usage?.input_tokens ?? 0,
      cache_read_input_tokens: parsedChunk.message.usage?.cache_read_input_tokens,
      cache_creation_input_tokens: parsedChunk.message.usage?.cache_creation_input_tokens,
    };
    return `data: ${JSON.stringify({
      id: fallbackId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: streamState.model,
      choices: [{
        delta: { role: 'assistant', content: '' },
        index: 0,
        logprobs: null,
        finish_reason: null,
      }],
    })}\n\n`;
  }

  if (parsedChunk.type === 'message_delta' && parsedChunk.usage) {
    const totalTokens =
      (streamState.usage?.prompt_tokens ?? 0) +
      (streamState.usage?.cache_creation_input_tokens ?? 0) +
      (streamState.usage?.cache_read_input_tokens ?? 0) +
      (parsedChunk.usage.output_tokens ?? 0);

    return `data: ${JSON.stringify({
      id: fallbackId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: streamState.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: transformFinishReason(parsedChunk.delta?.stop_reason),
      }],
      usage: {
        ...streamState.usage,
        completion_tokens: parsedChunk.usage.output_tokens,
        total_tokens: totalTokens,
      },
    })}\n\n`;
  }

  const textContent = parsedChunk.delta?.text;
  const toolCalls: any[] = [];

  if (parsedChunk.type === 'content_block_start' && parsedChunk.content_block?.type === 'tool_use') {
    streamState.toolIndex = (streamState.toolIndex ?? -1) + 1;
    toolCalls.push({
      index: streamState.toolIndex,
      id: parsedChunk.content_block.id,
      type: 'function',
      function: { name: parsedChunk.content_block.name, arguments: '' },
    });
  } else if (parsedChunk.type === 'content_block_delta' && parsedChunk.delta?.partial_json !== undefined) {
    toolCalls.push({
      index: streamState.toolIndex,
      function: { arguments: parsedChunk.delta.partial_json },
    });
  }

  return `data: ${JSON.stringify({
    id: fallbackId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: streamState.model,
    choices: [{
      delta: { content: textContent ?? null, tool_calls: toolCalls.length ? toolCalls : undefined },
      index: parsedChunk.index ?? 0,
      logprobs: null,
      finish_reason: null,
    }],
  })}\n\n`;
}

export function createAnthropicStream(
  response: Response,
  provider: string
): ReadableStream<ChatCompletionChunk> {
  const splitPattern = getSplitPattern(provider, '/v1/messages');
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body.getReader();
  const streamState: AnthropicStreamState = { toolIndex: -1 };

  const generator = parseSSEStream(
    reader,
    splitPattern,
    (chunk, fallbackId, state) => anthropicStreamTransform(chunk, fallbackId, state as AnthropicStreamState),
    fallbackId,
    streamState as unknown as Record<string, unknown>
  );

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunkStr of generator) {
          if (chunkStr && !chunkStr.includes('[DONE]')) {
            const parsed = parseSSEData<ChatCompletionChunk>(chunkStr);
            if (parsed) {
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