import type { Params, Message } from '../types/requestBody';
import type { TransformResult } from './types';
import { OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER, TOGETHER_AI, PERPLEXITY, GROQ, DEEPSEEK, MISTRAL_AI, COHERE, POWERED_BY } from '../globals';

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
    case TOGETHER_AI:
      return transformTogetherAIRequest(params, opts);
    case PERPLEXITY:
      return transformPerplexityAIRequest(params, opts);
    case GROQ:
      return transformGroqRequest(params, opts);
    case DEEPSEEK:
      return transformDeepSeekRequest(params, opts);
    case MISTRAL_AI:
      return transformMistralAIRequest(params, opts);
    case COHERE:
      return transformCohereRequest(params, opts);
    case 'azure-openai':
      return transformAzureOpenAIRequest(params, opts);
    case 'github':
      return transformGithubModelsRequest(params, opts);
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

function transformTogetherAIRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  return {
    body: {
      model: params.model || 'together-ai/llama-3-8b-instruct',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url: 'https://api.together.ai/v1/chat/completions',
  };
}

function transformPerplexityAIRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  return {
    body: {
      model: params.model || 'sonar',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url: 'https://api.perplexity.ai/chat/completions',
  };
}

function transformGroqRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  return {
    body: {
      model: params.model || 'llama-3.3-70b-versatile',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url: 'https://api.groq.com/openai/v1/chat/completions',
  };
}

function transformDeepSeekRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model: params.model || 'deepseek-chat',
    messages: params.messages,
    ...filterParams(params),
  };

  if (params.thinking !== undefined) {
    body.thinking = params.thinking;
  }

  return {
    body,
    headers,
    url: 'https://api.deepseek.com/chat/completions',
  };
}

function transformMistralAIRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  return {
    body: {
      model: params.model || 'mistral-medium-latest',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url: 'https://api.mistral.ai/v1/chat/completions',
  };
}

function transformCohereRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model: params.model || 'command-a-03-2025',
    messages: params.messages,
    ...filterParams(params),
  };

  if (params.reasoning_effort !== undefined) {
    body.reasoning_effort = params.reasoning_effort;
  }

  return {
    body,
    headers,
    url: 'https://api.cohere.ai/compatibility/v2/chat',
  };
}

/**
 * Azure OpenAI 请求转换
 * Azure 使用特殊的 URL 格式和认证方式
 */
function transformAzureOpenAIRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Azure 使用 api-key 认证而非 Bearer token
  const key = (opts.apiKey as string) || '';
  headers['api-key'] = key;

  // Azure 特定参数
  const resourceName = (opts.azureResourceName as string) || '';
  const deploymentId = (opts.azureDeploymentId as string) || '';
  const apiVersion = (opts.azureApiVersion as string) || '2024-06-01';

  // 构建 Azure 特定的 URL 格式
  const url = `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;

  return {
    body: {
      model: params.model || '',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url,
  };
}

/**
 * GitHub Models 请求转换
 * GitHub Models 使用 /inference/chat/completions 路径而非标准 /v1/chat/completions
 */
function transformGithubModelsRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  return {
    body: {
      model: params.model || '',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url: 'https://models.github.ai/inference/chat/completions',
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