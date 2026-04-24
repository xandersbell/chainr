import type { ChatCompletionResponse, ErrorResponse, EmbedResponse, ImageGenerateResponse, Model3DGenerateResponse } from './types';
import { OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER, TOGETHER_AI, PERPLEXITY, GROQ, DEEPSEEK, MISTRAL_AI, COHERE, NOMIC, JINA, VOYAGE, SEGMIND, RECRAFT_AI, STABILITY_AI, MESHY, TRIPO3D } from '../globals';

export type { ChatCompletionResponse, ErrorResponse, EmbedResponse, ImageGenerateResponse, Model3DGenerateResponse };

export function transformResponse(
  rawResponse: unknown,
  provider: string
): ChatCompletionResponse | ErrorResponse {
  const response = rawResponse as Record<string, unknown>;
  const status = response['status'] as number || 200;

  if (status === 204) {
    return { id: '', object: 'chat.completion', created: 0, model: '', choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }

  const json = response['data'] || response;

  if (status === 200 && json && typeof json === 'object') {
    const jsonObj = json as Record<string, unknown>;
    if ('error' in jsonObj) {
      switch (provider) {
        case OPEN_AI:
        case OPENROUTER:
        case TOGETHER_AI:
        case PERPLEXITY:
        case GROQ:
        case DEEPSEEK:
case MISTRAL_AI:
      case COHERE:
        return transformOpenAIError(status, json);
      case ANTHROPIC:
        return transformAnthropicError(status, json);
      case GOOGLE_VERTEX_AI:
        return transformVertexAIError(status, json);
      case 'reka-ai':
        return transformRekaAIResponse(json);
      default:
        return generateErrorResponse({ message: 'Unknown error', type: 'provider_error', param: null, code: null }, provider);
      }
    }
    switch (provider) {
      case OPEN_AI:
      case OPENROUTER:
      case TOGETHER_AI:
      case PERPLEXITY:
      case GROQ:
      case DEEPSEEK:
      case MISTRAL_AI:
      case COHERE:
        return json as ChatCompletionResponse;
      case 'reka-ai':
        return transformRekaAIResponse(json);
      case ANTHROPIC:
        return transformAnthropicResponse(json);
      case GOOGLE_VERTEX_AI:
        return transformVertexAIResponse(json);
      case 'bedrock':
        return transformBedrockResponse(json);
      default:
        return json as ChatCompletionResponse;
    }
  }

  switch (provider) {
    case OPEN_AI:
    case OPENROUTER:
    case TOGETHER_AI:
    case PERPLEXITY:
    case GROQ:
    case DEEPSEEK:
    case MISTRAL_AI:
    case COHERE:
      return transformOpenAIError(status, json);
    case ANTHROPIC:
      return transformAnthropicError(status, json);
    case GOOGLE_VERTEX_AI:
      return transformVertexAIError(status, json);
    case 'bedrock':
      return transformBedrockError(status, json);
    default:
      return generateErrorResponse({ message: 'Unknown error', type: 'provider_error', param: null, code: null }, provider);
  }
}

function transformAnthropicResponse(json: unknown): ChatCompletionResponse {
  const data = json as Record<string, unknown>;
  return {
    id: (data.id as string) || '',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: (data.model as string) || '',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: (data.content as Array<Record<string, unknown>>)?.[0]?.['text'] as string || '',
      },
      finish_reason: (data.stop_reason as string) || 'stop',
    }],
    usage: {
      prompt_tokens: (data.usage as Record<string, number>)?.['input_tokens'] || 0,
      completion_tokens: (data.usage as Record<string, number>)?.['output_tokens'] || 0,
      total_tokens: ((data.usage as Record<string, number>)?.['input_tokens'] || 0) + ((data.usage as Record<string, number>)?.['output_tokens'] || 0),
    },
  };
}

function transformVertexAIResponse(json: unknown): ChatCompletionResponse {
  const data = json as Record<string, unknown>;
  const candidates = data['candidates'] as Array<Record<string, unknown>> | undefined;
  const content = candidates?.[0]?.['content'] as Array<Record<string, unknown>> | undefined;
  const parts = content?.[0]?.['parts'] as Array<Record<string, unknown>> | undefined;

  return {
    id: `vertex-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: (data['modelVersion'] as string) || '',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: parts?.[0]?.['text'] as string || '',
      },
      finish_reason: candidates?.[0]?.['finishReason'] as string || 'STOP',
    }],
    usage: {
      prompt_tokens: (data['usageMetadata'] as Record<string, number>)?.['promptTokenCount'] || 0,
      completion_tokens: (data['usageMetadata'] as Record<string, number>)?.['candidatesTokenCount'] || 0,
      total_tokens: (data['usageMetadata'] as Record<string, number>)?.['totalTokenCount'] || 0,
    },
  };
}

function transformOpenAIError(status: number, json: unknown): ErrorResponse {
  const data = json as Record<string, unknown> | null;
  return generateErrorResponse({
    message: (data?.['error'] as Record<string, unknown>)?.['message'] as string || 'Unknown error',
    type: (data?.['error'] as Record<string, unknown>)?.['type'] as string || 'provider_error',
    param: null,
    code: status.toString(),
  }, OPEN_AI);
}

function transformAnthropicError(status: number, json: unknown): ErrorResponse {
  const data = json as Record<string, unknown> | null;
  return generateErrorResponse({
    message: (data?.['error'] as Record<string, unknown>)?.['message'] as string || 'Unknown error',
    type: (data?.['error'] as Record<string, unknown>)?.['type'] as string || 'provider_error',
    param: null,
    code: status.toString(),
  }, ANTHROPIC);
}

function transformVertexAIError(status: number, json: unknown): ErrorResponse {
  const data = json as Record<string, unknown> | null;
  return generateErrorResponse({
    message: (data?.['error'] as Record<string, unknown>)?.['message'] as string || 'Unknown error',
    type: (data?.['error'] as Record<string, unknown>)?.['type'] as string || 'provider_error',
    param: null,
    code: status.toString(),
  }, GOOGLE_VERTEX_AI);
}

export function generateErrorResponse(
  error: { message: string; type: string; param: string | null; code: string | null },
  provider: string
): ErrorResponse {
  return {
    error: {
      message: error.message,
      type: error.type,
      param: error.param,
      code: error.code,
      provider,
    },
  };
}

export function transformNomicEmbedResponse(json: unknown): EmbedResponse {
  const data = json as Record<string, unknown>;
  const embeddings = (data.data as Array<Record<string, unknown>>) || [];
  return {
    object: 'list',
    data: embeddings.map((item, index) => ({
      object: 'embedding',
      embedding: item.embedding as number[],
      index: item.index as number || index,
    })),
    model: (data.model as string) || '',
    usage: {
      prompt_tokens: ((data.usage as Record<string, number>)?.prompt_tokens) || 0,
      total_tokens: ((data.usage as Record<string, number>)?.total_tokens) || 0,
    },
    provider: NOMIC,
  };
}

export function transformJinaEmbedResponse(json: unknown): EmbedResponse {
  const data = json as Record<string, unknown>;
  const embeddings = (data.data as Array<Record<string, unknown>>) || [];
  return {
    object: 'list',
    data: embeddings.map((item, index) => ({
      object: 'embedding',
      embedding: item.embedding as number[],
      index: item.index as number || index,
    })),
    model: (data.model as string) || '',
    usage: {
      prompt_tokens: ((data.usage as Record<string, number>)?.prompt_tokens) || 0,
      total_tokens: ((data.usage as Record<string, number>)?.total_tokens) || 0,
    },
    provider: JINA,
  };
}

export function transformVoyageEmbedResponse(json: unknown): EmbedResponse {
  const data = json as Record<string, unknown>;
  const embeddings = (data.data as Array<Record<string, unknown>>) || [];
  return {
    object: 'list',
    data: embeddings.map((item, index) => ({
      object: 'embedding',
      embedding: item.embedding as number[],
      index: item.index as number || index,
    })),
    model: (data.model as string) || '',
    usage: {
      prompt_tokens: ((data.usage as Record<string, number>)?.prompt_tokens) || 0,
      total_tokens: ((data.usage as Record<string, number>)?.total_tokens) || 0,
    },
    provider: VOYAGE,
  };
}

export function transformSegmindImageResponse(json: unknown): ImageGenerateResponse {
  const data = json as Record<string, unknown>;
  return {
    created: Math.floor(Date.now() / 1000),
    data: [{
      b64_json: data.image as string | undefined,
    }],
    provider: SEGMIND,
  };
}

export function transformRecraftImageResponse(json: unknown): ImageGenerateResponse {
  const data = json as Record<string, unknown>;
  return {
    created: Math.floor(Date.now() / 1000),
    data: [{
      url: data.url as string | undefined,
      revised_prompt: data.revised_prompt as string | undefined,
    }],
    provider: RECRAFT_AI,
  };
}

export function transformStabilityImageResponse(json: unknown): ImageGenerateResponse {
  const data = json as Record<string, unknown>;
  const artifacts = (data.artifacts as Array<Record<string, unknown>>) || [];
  return {
    created: Math.floor(Date.now() / 1000),
    data: artifacts.map((artifact) => ({
      b64_json: artifact.base64 as string | undefined,
    })),
    provider: STABILITY_AI,
  };
}

export function transformMeshyResponse(json: unknown): Model3DGenerateResponse {
  const data = json as Record<string, unknown>;
  return {
    task_id: data.id as string || '',
    status: data.status as string || 'pending',
    model_url: data.model_url as string | undefined,
    provider: MESHY,
  };
}

export function transformTripo3DResponse(json: unknown): Model3DGenerateResponse {
  const data = json as Record<string, unknown>;
  return {
    task_id: data.id as string || '',
    status: data.status as string || 'pending',
    model_url: (data.result as Record<string, unknown>)?.model_url as string | undefined,
    provider: TRIPO3D,
  };
}

function transformRekaAIResponse(json: unknown): ChatCompletionResponse | ErrorResponse {
  const data = json as Record<string, unknown>;

  if ('detail' in data) {
    return generateErrorResponse(
      { message: JSON.stringify(data.detail), type: 'provider_error', param: null, code: null },
      'reka-ai'
    );
  }

  if ('text' in data) {
    const metadata = data.metadata as Record<string, number> || {};
    return {
      id: crypto.randomUUID(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: (data.model as string) || 'reka-flash',
      provider: 'reka-ai',
      choices: [
        {
          message: {
            role: 'assistant' as const,
            content: data.text as string,
          },
          index: 0,
          logprobs: null,
          finish_reason: (data.finish_reason as string) || 'stop',
        },
      ],
      usage: {
        prompt_tokens: metadata.input_tokens || 0,
        completion_tokens: metadata.generated_tokens || 0,
        total_tokens: (metadata.input_tokens || 0) + (metadata.generated_tokens || 0),
      },
    };
  }

  return generateErrorResponse(
    { message: 'Invalid Reka AI response format', type: 'provider_error', param: null, code: null },
    'reka-ai'
  );
}

function transformBedrockResponse(json: unknown): ChatCompletionResponse | ErrorResponse {
  const data = json as Record<string, unknown>;

  if ('message' in data) {
    const errorMsg = (data.message as string) || 'Bedrock error';
    return generateErrorResponse(
      { message: errorMsg, type: 'provider_error', param: null, code: null },
      'bedrock'
    );
  }

  const output = data.output as Record<string, unknown> | undefined;
  const message = output?.message as Record<string, unknown> | undefined;
  const content = message?.content as Array<Record<string, unknown>> | undefined;

  const textContent = content
    ?.filter((item) => item.text)
    .map((item) => item.text as string)
    .join('\n') || '';

  const usage = data.usage as Record<string, number> | undefined;
  const cacheReadInputTokens = usage?.cacheReadInputTokens || 0;
  const cacheWriteInputTokens = usage?.cacheWriteInputTokens || 0;

  return {
    id: `bedrock-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: (data.model as string) || '',
    provider: 'bedrock',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: textContent,
        },
        finish_reason: (data.stopReason as string) || 'stop',
      },
    ],
    usage: {
      prompt_tokens: (usage?.inputTokens || 0) + cacheReadInputTokens + cacheWriteInputTokens,
      completion_tokens: usage?.outputTokens || 0,
      total_tokens: usage?.totalTokens || 0,
      prompt_tokens_details: {
        cached_tokens: cacheReadInputTokens,
      },
    },
  };
}

function transformBedrockError(status: number, json: unknown): ErrorResponse {
  const data = json as Record<string, unknown> | null;
  const message = (data?.['message'] as string) || 'Bedrock error';
  return generateErrorResponse({
    message,
    type: 'provider_error',
    param: null,
    code: status.toString(),
  }, 'bedrock');
}