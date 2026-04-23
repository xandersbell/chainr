import type { Params, Message } from '../types/requestBody';
import type { TransformResult } from './types';
import { OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER, POWERED_BY } from '../globals';

const PROVIDER_ALIASES: Record<string, string> = {
  'google-vertexai': GOOGLE_VERTEX_AI,
  'google-vertex-ai': GOOGLE_VERTEX_AI,
  'vertexai': GOOGLE_VERTEX_AI,
  'gcp-vertex': GOOGLE_VERTEX_AI,
};

function normalizeProvider(provider: string): string {
  return PROVIDER_ALIASES[provider] || provider;
}

export function transformRequest(
  params: Params,
  provider: string,
  providerOptions: unknown
): TransformResult {
  const opts = providerOptions as Record<string, unknown>;
  const normalizedProvider = normalizeProvider(provider);

  switch (normalizedProvider) {
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

interface AnthropicRequestBody {
  model: string;
  messages: Message[];
  system?: string;
  max_tokens: number;
  metadata?: Record<string, unknown>;
}

function extractSystemMessage(messages: Message[]): { system: string | undefined; filteredMessages: Message[] } {
  const systemMessages: string[] = [];
  const filteredMessages: Message[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessages.push(msg.content as string);
    } else {
      filteredMessages.push(msg);
    }
  }

  const system = systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined;
  return { system, filteredMessages };
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

  const { system, filteredMessages } = extractSystemMessage(params.messages || []);

  const body: AnthropicRequestBody = {
    model: params.model || 'claude-3-5-sonnet-20241022',
    messages: filteredMessages,
    max_tokens: params.max_tokens || 1024,
  };

  if (system) {
    body.system = system;
  }

  if (opts.anthropicMetadata) {
    body.metadata = opts.anthropicMetadata as Record<string, unknown>;
  }

  return {
    body,
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

  const { system, filteredMessages } = extractSystemMessage(params.messages || []);

  const body: Record<string, unknown> = {
    contents: filteredMessages,
  };

  if (system) {
    body.systemInstruction = {
      parts: [{ text: system }],
    };
  }

  const generationConfig: Record<string, unknown> = {};
  if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
  if (params.top_p !== undefined) generationConfig.topP = params.top_p;
  if (params.max_tokens !== undefined) generationConfig.maxOutputTokens = params.max_tokens;

  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  return {
    body,
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
  headers['X-OpenRouter-Title'] = POWERED_BY;

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