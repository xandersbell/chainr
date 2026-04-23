import type { Params } from '../types/requestBody';
import type { TransformResult } from './types';
import { OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER, POWERED_BY } from '../globals';

export function transformRequest(
  params: Params,
  provider: string,
  providerOptions: unknown
): TransformResult {
  const opts = providerOptions as Record<string, unknown>;

  switch (provider) {
    case OPEN_AI:
      return transformOpenAIRequest(params, opts);
    case ANTHROPIC:
      return transformAnthropicRequest(params, opts);
    case GOOGLE_VERTEX_AI:
      return transformVertexAIRequest(params, opts);
    case OPENROUTER:
      return transformOpenRouterRequest(params, opts);
    default:
      return {
        body: params as Record<string, unknown>,
        headers: { 'Content-Type': 'application/json' },
        url: '',
      };
  }
}

function transformOpenAIRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  if (opts.openaiOrganization) {
    headers['OpenAI-Organization'] = opts.openaiOrganization as string;
  }
  if (opts.openaiProject) {
    headers['OpenAI-Project'] = opts.openaiProject as string;
  }

  return {
    body: {
      model: params.model || 'gpt-3.5-turbo',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url: 'https://api.openai.com/v1/chat/completions',
  };
}

function transformAnthropicRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || (opts.anthropicApiKey as string) || '';
  headers['X-API-Key'] = key;

  const betaHeader = (opts.anthropicBeta as string) || 'messages-2023-12-15';
  const version = (opts.anthropicVersion as string) || '2023-06-01';
  headers['anthropic-beta'] = betaHeader;
  headers['anthropic-version'] = version;

  return {
    body: {
      model: params.model || 'claude-3-5-sonnet-20241022',
      messages: params.messages,
      max_tokens: params.max_tokens || 1024,
    },
    headers,
    url: 'https://api.anthropic.com/v1/messages',
  };
}

function transformVertexAIRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const projectId = (opts.vertexProjectId as string) || '';
  const region = (opts.vertexRegion as string) || 'us-central1';
  const model = params.model || 'gemini-1.5-flash';

  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

  return {
    body: {
      contents: params.messages,
    },
    headers,
    url,
  };
}

function transformOpenRouterRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;
  headers['HTTP-Referer'] = 'https://chainr.dev/';
  headers['X-Title'] = POWERED_BY;

  return {
    body: {
      model: params.model || 'openrouter/auto',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url: 'https://openrouter.ai/api/v1/chat/completions',
  };
}

function filterParams(params: Params): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (params.temperature !== undefined) result.temperature = params.temperature;
  if (params.top_p !== undefined) result.top_p = params.top_p;
  if (params.max_tokens !== undefined) result.max_tokens = params.max_tokens;
  if (params.stream !== undefined) result.stream = params.stream;
  if (params.stop !== undefined) result.stop = params.stop;
  if (params.tools !== undefined) result.tools = params.tools;
  if (params.tool_choice !== undefined) result.tool_choice = params.tool_choice;

  return result;
}
