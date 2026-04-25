import type { ChatCompletionChunk } from './types/streaming';
import { parseSSEDataMultiple } from './sseParser';
import { getFallbackChunkId } from './streamUtils';

interface BedrockStreamState {
  stopReason?: string;
  currentToolCallIndex: number;
}

function readUInt32be(buffer: Uint8Array, offset: number): number {
  return (
    ((buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3]) >>>
    0
  );
}

function getPayloadFromAwsChunk(chunk: Uint8Array): string {
  const decoder = new TextDecoder();
  const chunkLength = readUInt32be(chunk, 0);
  const headersLength = readUInt32be(chunk, 4);

  const headersEnd = 12 + headersLength;
  const payloadLength = chunkLength - headersEnd - 4;
  const payload = chunk.slice(headersEnd, headersEnd + payloadLength);
  const decodedJson = JSON.parse(decoder.decode(payload));
  return decodedJson.bytes
    ? Buffer.from(decodedJson.bytes, 'base64').toString()
    : JSON.stringify(decodedJson);
}

function concatenateUint8Arrays(a: Uint8Array<ArrayBufferLike>, b: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

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
    '1': 'stop',
    '2': 'length',
    '3': 'stop',
    '4': 'content_filter',
  };
  return mapping[reason] || 'stop';
}

function bedrockStreamTransform(
  responseChunk: string,
  fallbackId: string,
  streamState: BedrockStreamState,
  strictOpenAiCompliance?: boolean,
  model?: string
): string | string[] | undefined {
  let parsedChunk: any;
  try {
    parsedChunk = JSON.parse(responseChunk);
  } catch {
    return;
  }

  if (parsedChunk.message) {
    return `data: ${JSON.stringify({
      id: fallbackId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model || '',
      provider: 'bedrock',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'error',
        },
      ],
    })}\n\n`;
  }

  if (parsedChunk.stopReason) {
    streamState.stopReason = parsedChunk.stopReason;
  }

  if (streamState.currentToolCallIndex === undefined) {
    streamState.currentToolCallIndex = -1;
  }

  if (parsedChunk.usage) {
    const cacheReadInputTokens = parsedChunk.usage?.cacheReadInputTokens || 0;
    const cacheWriteInputTokens = parsedChunk.usage?.cacheWriteInputTokens || 0;

    return [
      `data: ${JSON.stringify({
        id: fallbackId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model || '',
        provider: 'bedrock',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: transformFinishReason(
              streamState.stopReason ?? null,
              strictOpenAiCompliance
            ),
          },
        ],
        usage: {
          prompt_tokens:
            parsedChunk.usage.inputTokens +
            cacheReadInputTokens +
            cacheWriteInputTokens,
          completion_tokens: parsedChunk.usage.outputTokens,
          total_tokens: parsedChunk.usage.totalTokens,
          prompt_tokens_details: {
            cached_tokens: cacheReadInputTokens,
          },
          ...((cacheReadInputTokens > 0 || cacheWriteInputTokens > 0) && {
            cache_read_input_tokens: cacheReadInputTokens,
            cache_creation_input_tokens: cacheWriteInputTokens,
          }),
        },
      })}\n\n`,
      `data: [DONE]\n\n`,
    ];
  }

  const toolCalls: any[] = [];
  if (parsedChunk.start?.toolUse) {
    streamState.currentToolCallIndex = streamState.currentToolCallIndex + 1;
    toolCalls.push({
      index: streamState.currentToolCallIndex,
      id: parsedChunk.start.toolUse.toolUseId,
      type: 'function',
      function: {
        name: parsedChunk.start.toolUse.name,
        arguments: parsedChunk.start.toolUse.input,
      },
    });
  } else if (parsedChunk.delta?.toolUse) {
    toolCalls.push({
      index: streamState.currentToolCallIndex,
      id: parsedChunk.delta.toolUse.toolUseId,
      type: 'function',
      function: {
        name: parsedChunk.delta.toolUse.name,
        arguments: parsedChunk.delta.toolUse.input,
      },
    });
  }

  const content = parsedChunk.delta?.text;

  const contentBlockObject: any = {
    index: parsedChunk.contentBlockIndex ?? 0,
    delta: {},
  };
  if (parsedChunk.delta?.reasoningContent?.text)
    contentBlockObject.delta.thinking = parsedChunk.delta.reasoningContent.text;
  if (parsedChunk.delta?.reasoningContent?.signature)
    contentBlockObject.delta.signature = parsedChunk.delta.reasoningContent.signature;
  if (parsedChunk.delta?.text)
    contentBlockObject.delta.text = parsedChunk.delta.text;
  if (parsedChunk.delta?.reasoningContent?.redactedContent)
    contentBlockObject.delta.data = parsedChunk.delta.reasoningContent.redactedContent;

  return `data: ${JSON.stringify({
    id: fallbackId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: model || '',
    provider: 'bedrock',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          content,
          ...(!strictOpenAiCompliance &&
            !toolCalls.length &&
            Object.keys(contentBlockObject.delta).length > 0 && {
              content_blocks: [contentBlockObject],
            }),
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: null,
      },
    ],
  })}\n\n`;
}

export async function* readAWSStream(
  reader: ReadableStreamDefaultReader,
  transformFunction: ((responseChunk: string, fallbackId: string, streamState: BedrockStreamState, strictOpenAiCompliance?: boolean, model?: string) => string | string[] | undefined) | undefined,
  fallbackChunkId: string,
  model?: string,
  strictOpenAiCompliance?: boolean
): AsyncGenerator<string | undefined> {
  let buffer = new Uint8Array();
  let expectedLength = 0;
  const streamState: BedrockStreamState = { currentToolCallIndex: -1 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.length) {
        expectedLength = readUInt32be(buffer, 0);
        while (buffer.length >= expectedLength && buffer.length !== 0) {
          const data = buffer.subarray(0, expectedLength);
          buffer = buffer.subarray(expectedLength);
          expectedLength = readUInt32be(buffer, 0);
          const payload = getPayloadFromAwsChunk(data);
          if (transformFunction) {
            const transformedChunk = transformFunction(
              payload,
              fallbackChunkId,
              streamState,
              strictOpenAiCompliance,
              model
            );
            if (Array.isArray(transformedChunk)) {
              for (const item of transformedChunk) {
                yield item;
              }
            } else {
              yield transformedChunk;
            }
          } else {
            yield payload;
          }
        }
      }
      break;
    }

    if (expectedLength === 0) {
      expectedLength = readUInt32be(value, 0);
    }

    buffer = concatenateUint8Arrays(buffer, value);

    while (buffer.length >= expectedLength && buffer.length !== 0) {
      const data = buffer.subarray(0, expectedLength);
      buffer = buffer.subarray(expectedLength);

      expectedLength = readUInt32be(buffer, 0);
      const payload = getPayloadFromAwsChunk(data);

      if (transformFunction) {
        const transformedChunk = transformFunction(
          payload,
          fallbackChunkId,
          streamState,
          strictOpenAiCompliance,
          model
        );
        if (Array.isArray(transformedChunk)) {
          for (const item of transformedChunk) {
            yield item;
          }
        } else {
          yield transformedChunk;
        }
      } else {
        yield payload;
      }
    }
  }
}

export function createBedrockStream(
  response: Response,
  provider: string,
  model?: string,
  strictOpenAiCompliance: boolean = false
): ReadableStream<ChatCompletionChunk> {
  const fallbackId = getFallbackChunkId(provider);
  const reader = response.body!.getReader();

  const generator = readAWSStream(
    reader,
    bedrockStreamTransform,
    fallbackId,
    model,
    strictOpenAiCompliance
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

export function isBedrockProvider(provider: string): boolean {
  return provider === 'bedrock';
}
