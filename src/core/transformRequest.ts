import type { Params, Message } from '../types/requestBody';
import type { TransformResult } from './types';
import { OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER, TOGETHER_AI, PERPLEXITY, GROQ, DEEPSEEK, MISTRAL_AI, COHERE, POWERED_BY, NOMIC, JINA, VOYAGE, JINA_URL, NOMIC_URL, VOYAGE_URL, SEGMIND, RECRAFT_AI, STABILITY_AI, MESHY, TRIPO3D, SEGMIND_URL, RECRAFT_AI_URL, STABILITY_AI_URL, MESHY_URL, TRIPO3D_URL, OPENAI_COMPATIBLE_URLS, OPENAI_WHISPER_URL, OPENAI_TTS_URL, OPENAI_EMBED_URL, LEMONFOX, LEMONFOX_TRANSCRIBE_URL, LEMONFOX_IMAGE_URL, WORKERS_AI_EMBED_URL, WORKERS_AI_IMAGE_URL, SILICONFLOW_EMBED_URL, SILICONFLOW_IMAGE_URL, NSCALE, NSCALE_URL, LEPTON } from '../globals';

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
    case 'azure-ai':
      return transformAzureAIRequest(params, opts);
    case 'reka-ai':
      return transformRekaAIRequest(params, opts);
    case NOMIC:
      return transformNomicEmbedRequest(params, opts);
    case JINA:
      return transformJinaEmbedRequest(params, opts);
    case VOYAGE:
      return transformVoyageEmbedRequest(params, opts);
    case SEGMIND:
      return transformSegmindImageRequest(params, opts);
    case RECRAFT_AI:
      return transformRecraftImageRequest(params, opts);
    case STABILITY_AI:
      return transformStabilityImageRequest(params, opts);
    case MESHY:
      return transformMeshyRequest(params, opts);
    case TRIPO3D:
      return transformTripo3DRequest(params, opts);
    default: {
      const optsRecord = opts as Record<string, unknown>;
      const customHost = optsRecord?.customHost as string | undefined;
      const urlToFetch = optsRecord?.urlToFetch as string | undefined;
      const apiKeyRaw = optsRecord?.apiKey;
      const key = typeof apiKeyRaw === 'string' && apiKeyRaw.length > 0 ? apiKeyRaw : '';

      let url = '';
      if (urlToFetch) {
        url = urlToFetch;
      } else if (customHost) {
        url = customHost;
      } else {
        url = OPENAI_COMPATIBLE_URLS[normalizedProvider] || '';
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (key.length > 0) {
        headers['Authorization'] = `Bearer ${key}`;
      }

      return {
        body: params as Record<string, unknown>,
        headers,
        url,
      };
    }
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
 * Azure AI Inference 请求转换
 * Azure AI Foundry 使用标准 OpenAI-compatible 格式
 */
function transformAzureAIRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const foundryUrl = (opts.azureFoundryUrl as string) || '';

  return {
    body: {
      model: params.model || '',
      messages: params.messages,
      ...filterParams(params),
    },
    headers,
    url: foundryUrl,
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

function transformNomicEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const input = params.input as string[];
  const body: Record<string, unknown> = {
    input: input,
    model: params.model || 'nomic-embed-text-v1.5',
  };

  if (opts.taskType) {
    body.task_type = opts.taskType;
  }

  return {
    body,
    headers,
    url: `${NOMIC_URL}/embedding/text`,
  };
}

function transformJinaEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  return {
    body: {
      input: params.input,
      model: params.model || 'jina-embeddings-v4',
      normalized: true,
    },
    headers,
    url: `${JINA_URL}/embeddings`,
  };
}

function transformVoyageEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    input: params.input,
    model: params.model || 'voyage-3-lite',
  };

  if (opts.inputType) {
    body.input_type = opts.inputType;
  }

  if (opts.outputDimension) {
    body.output_dimension = opts.outputDimension;
  }

  return {
    body,
    headers,
    url: `${VOYAGE_URL}/v1/embeddings`,
  };
}

function transformSegmindImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['x-api-key'] = key;

  const body: Record<string, unknown> = {
    prompt: params.prompt,
  };

  if (params.size) {
    const [width, height] = params.size.split('x').map(Number);
    if (width && height) {
      body.img_width = width;
      body.img_height = height;
    }
  }

  if (params.n) body.n = params.n;
  if (params.quality) body.quality = params.quality;
  if (params.style) body.style = params.style;

  return {
    body,
    headers,
    url: `${SEGMIND_URL}/v1/image/sdxl`,
  };
}

function transformRecraftImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    response_format: 'b64_json',
  };

  if (params.model) body.model = params.model;
  if (opts.styleId) body.style_id = opts.styleId;

  return {
    body,
    headers,
    url: `${RECRAFT_AI_URL}/v1/images/generation`,
  };
}

function transformStabilityImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    text_prompts: [{ text: params.prompt, weight: 1 }],
  };

  if (params.size) {
    const [width, height] = params.size.split('x').map(Number);
    if (width && height) {
      body.width = width;
      body.height = height;
    }
  }

  if (params.n) body.n = params.n;
  if (params.seed) body.seed = params.seed;
  if (params.quality) body.quality = params.quality;

  const model = params.model || 'stable-diffusion-v1-6';
  return {
    body,
    headers,
    url: `${STABILITY_AI_URL}/v1/generation/${model}/text-to-image`,
  };
}

function transformMeshyRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    style_preset: (opts.stylePreset as string) || 'realistic',
  };

  const meshyMode = (opts.mode as string) || 'text-to-3d';
  const endpoint = meshyMode === 'image-to-3d' ? 'image-to-3d' : 'text-to-3d';

  return {
    body,
    headers,
    url: `${MESHY_URL}/v1/${endpoint}`,
  };
}

function transformTripo3DRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  return {
    body: {
      prompt: params.prompt,
      model: params.model || 'tripo3d',
    },
    headers,
    url: `${TRIPO3D_URL}/v1/tasks`,
  };
}

function transformOpenAIWhisperRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {};

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const formData = new FormData();
  formData.append('model', (params.model as string) || 'whisper-1');

  if (params.file) {
    if (params.file instanceof Blob) {
      formData.append('file', params.file, 'audio.mp3');
    }
  }

  if (params.language) formData.append('language', params.language);
  if (params.prompt) formData.append('prompt', params.prompt as string);
  if (params.response_format) formData.append('response_format', params.response_format as string);
  if (params.temperature) formData.append('temperature', String(params.temperature));

  return {
    body: formData,
    headers,
    url: OPENAI_WHISPER_URL,
    isFormData: true,
  };
}

function transformLemonFoxTranscribeRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {};

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const formData = new FormData();
  formData.append('model', (params.model as string) || 'whisper-1');

  if (params.file) {
    if (params.file instanceof Blob) {
      formData.append('file', params.file, 'audio.mp3');
    }
  }

  if (params.language) formData.append('language', params.language);
  if (params.prompt) formData.append('prompt', params.prompt as string);
  if (params.response_format) formData.append('response_format', params.response_format as string);

  return {
    body: formData,
    headers,
    url: LEMONFOX_TRANSCRIBE_URL,
    isFormData: true,
  };
}

function transformOpenAISpeechRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model: (params.model as string) || 'tts-1',
    input: params.input as string,
    voice: (params.voice as string) || 'alloy',
  };

  if (params.response_format) body.response_format = params.response_format;
  if (params.speed) body.speed = params.speed;

  return {
    body,
    headers,
    url: OPENAI_TTS_URL,
  };
}

function transformOpenAIEmbeddingsRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model: params.model || 'text-embedding-3-small',
    input: params.input,
  };

  if (params.user) body.user = params.user;
  if (params.dimensions) body.dimensions = params.dimensions;
  if (params.encoding_format) body.encoding_format = params.encoding_format;

  return {
    body,
    headers,
    url: OPENAI_EMBED_URL,
  };
}

function transformCohereEmbeddingsRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const input = params.input;
  const texts = Array.isArray(input) ? input.map(i => typeof i === 'string' ? i : i.text) : [typeof input === 'string' ? input : input.text];

  const body: Record<string, unknown> = {
    model: params.model || 'embed-english-v3.0',
    texts,
  };

  if (params.encoding_format) body.input_type = 'search_document';
  if (params.dimensions) body.truncate = 'END';

  return {
    body,
    headers,
    url: 'https://api.cohere.ai/v2/embed',
  };
}

function transformWorkersAIEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const accountId = (opts.workersAiAccountId as string) || '';
  const input = params.input;
  const texts = Array.isArray(input) ? input.map(i => typeof i === 'string' ? i : i.text) : [typeof input === 'string' ? input : input.text];

  const body: Record<string, unknown> = {
    text: texts,
  };

  const model = params.model || '@cf/baai/bge-base-en-v1.5';

  return {
    body,
    headers,
    url: `${WORKERS_AI_EMBED_URL}/${accountId}/${model}`,
  };
}

function transformSiliconFlowEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const input = params.input;
  const texts = Array.isArray(input) ? input.map(i => typeof i === 'string' ? i : i.text) : [typeof input === 'string' ? input : input.text];

  const body: Record<string, unknown> = {
    model: params.model || 'BAAI/bge-base-zh-v1.5',
    input: texts,
  };

  if (params.user) body.user = params.user;

  return {
    body,
    headers,
    url: SILICONFLOW_EMBED_URL,
  };
}

function transformOpenAIDALLERequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    model: params.model || 'dall-e-3',
  };

  if (params.n) body.n = params.n;
  if (params.quality) body.quality = params.quality;
  if (params.size) body.size = params.size;
  if (params.style) body.style = params.style;
  if (params.response_format) body.response_format = params.response_format;

  return {
    body,
    headers,
    url: 'https://api.openai.com/v1/images/generations',
  };
}

function transformLemonFoxImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    model: params.model || 'dall-e-3',
  };

  if (params.n) body.n = params.n;
  if (params.size) body.size = params.size;
  if (params.response_format) body.response_format = params.response_format;

  return {
    body,
    headers,
    url: LEMONFOX_IMAGE_URL,
  };
}

function transformWorkersAIImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const accountId = (opts.workersAiAccountId as string) || '';

  const body: Record<string, unknown> = {
    prompt: params.prompt,
  };

  if (params.model) body.model = params.model;
  if (params.num_steps) body.num_steps = params.num_steps;

  return {
    body,
    headers,
    url: `${WORKERS_AI_IMAGE_URL}/${accountId}/@cf/l stabilityai/stable-diffusion-xl-base-1.0`,
  };
}

function transformNScaleImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    prompt: params.prompt,
  };

  if (params.model) body.model = params.model;
  if (params.num_steps) body.num_inference_steps = params.num_steps;
  if (params.guidance) body.guidance_scale = params.guidance;

  return {
    body,
    headers,
    url: NSCALE_URL,
  };
}

export function transformEmbedRequest(
  params: Params,
  provider: string,
  providerOptions: unknown
): TransformResult {
  const opts = providerOptions as Record<string, unknown>;
  const normalizedProvider = normalizeProvider(provider);

  switch (normalizedProvider) {
    case OPEN_AI:
    case 'openai-embeddings':
      return transformOpenAIEmbeddingsRequest(params, opts);
    case COHERE:
      return transformCohereEmbeddingsRequest(params, opts);
    case 'workers-ai':
      return transformWorkersAIEmbedRequest(params, opts);
    case 'siliconflow':
      return transformSiliconFlowEmbedRequest(params, opts);
    case 'ai21':
    case 'ai21-embed':
      return transformAI21EmbedRequest(params, opts);
    case MISTRAL_AI:
    case 'mistral-ai-embed':
      return transformMistralAIEmbedRequest(params, opts);
    case TOGETHER_AI:
    case 'together-ai-embed':
      return transformTogetherAIEmbedRequest(params, opts);
    case 'anyscale':
    case 'anyscale-embed':
      return transformAnyscaleEmbedRequest(params, opts);
    case 'fireworks-ai':
    case 'fireworks-ai-embed':
      return transformFireworksAIEmbedRequest(params, opts);
    case 'google':
      return transformGoogleEmbedRequest(params, opts);
    case GOOGLE_VERTEX_AI:
    case 'google-vertex-ai':
    case 'vertex-ai':
      return transformGoogleVertexEmbedRequest(params, opts);
    case 'bedrock':
      return transformBedrockEmbedRequest(params, opts);
    default:
      return transformOpenAIEmbeddingsRequest(params, opts);
  }
}

export function transformImageRequest(
  params: Params,
  provider: string,
  providerOptions: unknown
): TransformResult {
  const opts = providerOptions as Record<string, unknown>;
  const normalizedProvider = normalizeProvider(provider);

  switch (normalizedProvider) {
    case OPEN_AI:
    case 'openai-dalle':
      return transformOpenAIDALLERequest(params, opts);
    case LEMONFOX:
      return transformLemonFoxImageRequest(params, opts);
    case 'workers-ai':
      return transformWorkersAIImageRequest(params, opts);
    case NSCALE:
      return transformNScaleImageRequest(params, opts);
    case 'deepbricks':
    case 'deepbricks-image':
      return transformDeepbricksImageRequest(params, opts);
    case 'hyperbolic':
    case 'hyperbolic-image':
      return transformHyperbolicImageRequest(params, opts);
    case GOOGLE_VERTEX_AI:
    case 'google-vertex-ai':
    case 'vertex-ai':
      return transformGoogleImageRequest(params, opts);
    default:
      return transformOpenAIDALLERequest(params, opts);
  }
}

export function transformAudioRequest(
  params: Params,
  provider: string,
  providerOptions: unknown
): TransformResult {
  const opts = providerOptions as Record<string, unknown>;
  const normalizedProvider = normalizeProvider(provider);

  switch (normalizedProvider) {
    case OPEN_AI:
      return transformOpenAIWhisperRequest(params, opts);
    case LEMONFOX:
      return transformLemonFoxTranscribeRequest(params, opts);
    case LEPTON:
    case 'lepton':
    case 'lepton-transcribe':
      return transformLeptonTranscribeRequest(params, opts);
    case 'azure-openai':
      return transformAzureWhisperRequest(params, opts);
    default:
      return transformOpenAIWhisperRequest(params, opts);
  }
}

export function transformSpeechRequest(
  params: Params,
  provider: string,
  providerOptions: unknown
): TransformResult {
  const opts = providerOptions as Record<string, unknown>;
  const normalizedProvider = normalizeProvider(provider);

  switch (normalizedProvider) {
    case OPEN_AI:
      return transformOpenAISpeechRequest(params, opts);
    case 'azure-openai':
      return transformAzureSpeechRequest(params, opts);
    default:
      return transformOpenAISpeechRequest(params, opts);
  }
}

function transformOpenAITranslationRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model: (params.model as string) || 'whisper-1',
  };

  if (params.file) {
    if (params.file instanceof Blob) {
      const formData = new FormData();
      formData.append('model', body.model as string);
      formData.append('file', params.file, 'audio.mp3');
      return {
        body: formData,
        headers,
        url: 'https://api.openai.com/v1/audio/translations',
        isFormData: true,
      };
    }
  }

  return {
    body,
    headers,
    url: 'https://api.openai.com/v1/audio/translations',
  };
}

function transformLemonFoxTranslationRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {};

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const formData = new FormData();
  formData.append('model', (params.model as string) || 'whisper-1');

  if (params.file) {
    if (params.file instanceof Blob) {
      formData.append('file', params.file, 'audio.mp3');
    }
  }

  return {
    body: formData,
    headers,
    url: LEMONFOX_TRANSCRIBE_URL.replace('/transcriptions', '/translations'),
    isFormData: true,
  };
}

function transformLeptonTranscribeRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {};

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const formData = new FormData();
  formData.append('model', (params.model as string) || 'whisper-1');

  if (params.file) {
    if (params.file instanceof Blob) {
      formData.append('file', params.file, 'audio.mp3');
    }
  }

  if (params.language) formData.append('language', params.language);
  if (params.response_format) formData.append('response_format', params.response_format as string);

  return {
    body: formData,
    headers,
    url: 'https://api.lepton.ai/v1/audio/transcriptions',
    isFormData: true,
  };
}

function transformAI21EmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const input = params.input;
  const texts = Array.isArray(input) ? input.map(i => typeof i === 'string' ? i : i.text) : [typeof input === 'string' ? input : input.text];

  const body: Record<string, unknown> = {
    texts,
  };

  if (params.model) body.model = params.model;

  return {
    body,
    headers,
    url: 'https://api.ai21.com/v1/embeddings',
  };
}

function transformMistralAIEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const input = params.input;
  const inputArray = Array.isArray(input) ? input.map(i => typeof i === 'string' ? i : i.text) : [typeof input === 'string' ? input : input.text];

  const body: Record<string, unknown> = {
    model: params.model || 'mistral-embed',
    input: inputArray,
  };

  return {
    body,
    headers,
    url: 'https://api.mistral.ai/v1/embeddings',
  };
}

function transformTogetherAIEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const input = params.input;
  const inputArray = Array.isArray(input) ? input.map(i => typeof i === 'string' ? i : i.text) : [typeof input === 'string' ? input : input.text];

  const body: Record<string, unknown> = {
    model: params.model || 'mistral-embed',
    input: inputArray,
  };

  return {
    body,
    headers,
    url: 'https://api.together.ai/v1/embeddings',
  };
}

function transformAnyscaleEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model: params.model || 'thenlper/gte-large',
    input: params.input,
  };

  if (params.user) body.user = params.user;

  return {
    body,
    headers,
    url: 'https://api.endpoints.anyscale.com/v1/embeddings',
  };
}

function transformFireworksAIEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const input = params.input;
  const inputArray = Array.isArray(input) ? input.map(i => typeof i === 'string' ? i : i.text) : [typeof input === 'string' ? input : input.text];

  const body: Record<string, unknown> = {
    model: params.model || 'nomic-ai/nomic-embed-text-v1.5',
    input: inputArray,
  };

  if (params.dimensions) body.dimensions = params.dimensions;

  return {
    body,
    headers,
    url: 'https://api.fireworks.ai/v1/embeddings',
  };
}

function transformDeepbricksImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    model: params.model || 'dall-e-2',
  };

  if (params.n) body.n = params.n;
  if (params.size) body.size = params.size;
  if (params.quality) body.quality = params.quality;
  if (params.response_format) body.response_format = params.response_format;
  if (params.style) body.style = params.style;

  return {
    body,
    headers,
    url: 'https://api.deepbricks.io/v1/images/generations',
  };
}

function transformHyperbolicImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const body: Record<string, unknown> = {
    model: (params.model as string) || 'stabilityai/stable-diffusion-xl-base-1.0',
    prompt: params.prompt,
  };

  if (params.n) body.n = params.n;
  if (params.size) {
    const [width, height] = (params.size as string).split('x');
    if (width) body.width = parseInt(width);
    if (height) body.height = parseInt(height);
  }

  return {
    body,
    headers,
    url: 'https://api.hyperbolic.ai/v1/images/generations',
  };
}

export function transformTranslationRequest(
  params: Params,
  provider: string,
  providerOptions: unknown
): TransformResult {
  const opts = providerOptions as Record<string, unknown>;
  const normalizedProvider = normalizeProvider(provider);

  switch (normalizedProvider) {
    case OPEN_AI:
      return transformOpenAITranslationRequest(params, opts);
    case LEMONFOX:
      return transformLemonFoxTranslationRequest(params, opts);
    case 'azure-openai':
      return transformAzureTranslationRequest(params, opts);
    default:
      return transformOpenAITranslationRequest(params, opts);
  }
}

export function transformLeptonRequest(
  params: Params,
  provider: string,
  providerOptions: unknown
): TransformResult {
  const opts = providerOptions as Record<string, unknown>;
  return transformLeptonTranscribeRequest(params, opts);
}

function transformAzureWhisperRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'multipart/form-data',
  };

  const key = (opts.apiKey as string) || '';
  headers['api-key'] = key;

  const resourceName = (opts.azureResourceName as string) || '';
  const deploymentId = (opts.azureDeploymentId as string) || 'whisper';
  const apiVersion = (opts.azureApiVersion as string) || '2024-02-15-preview';

  const formData = new FormData();
  formData.append('model', (params.model as string) || 'whisper-1');

  if (params.file && params.file instanceof Blob) {
    formData.append('file', params.file, 'audio.mp3');
  }

  if (params.language) formData.append('language', params.language);
  if (params.prompt) formData.append('prompt', params.prompt as string);
  if (params.response_format) formData.append('response_format', params.response_format as string);
  if (params.temperature) formData.append('temperature', String(params.temperature));

  return {
    body: formData,
    headers,
    url: `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentId}/audio/transcriptions?api-version=${apiVersion}`,
    isFormData: true,
  };
}

function transformAzureSpeechRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['api-key'] = key;

  const resourceName = (opts.azureResourceName as string) || '';
  const deploymentId = (opts.azureDeploymentId as string) || 'tts';
  const apiVersion = (opts.azureApiVersion as string) || '2024-02-15-preview';

  const body: Record<string, unknown> = {
    model: (params.model as string) || 'tts-1',
    input: params.input as string,
    voice: (params.voice as string) || 'alloy',
  };

  if (params.response_format) body.response_format = params.response_format;
  if (params.speed) body.speed = params.speed;

  return {
    body,
    headers,
    url: `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentId}/audio/speech?api-version=${apiVersion}`,
  };
}

function transformAzureTranslationRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'multipart/form-data',
  };

  const key = (opts.apiKey as string) || '';
  headers['api-key'] = key;

  const resourceName = (opts.azureResourceName as string) || '';
  const deploymentId = (opts.azureDeploymentId as string) || 'whisper';
  const apiVersion = (opts.azureApiVersion as string) || '2024-02-15-preview';

  const formData = new FormData();
  formData.append('model', (params.model as string) || 'whisper-1');

  if (params.file && params.file instanceof Blob) {
    formData.append('file', params.file, 'audio.mp3');
  }

  if (params.prompt) formData.append('prompt', params.prompt as string);
  if (params.response_format) formData.append('response_format', params.response_format as string);
  if (params.temperature) formData.append('temperature', String(params.temperature));

  return {
    body: formData,
    headers,
    url: `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentId}/audio/translations?api-version=${apiVersion}`,
    isFormData: true,
  };
}

function transformGoogleEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const key = (opts.apiKey as string) || '';
  headers['Authorization'] = `Bearer ${key}`;

  const input = params.input;
  let instances;
  if (Array.isArray(input)) {
    instances = input.map(i => ({ parts: [{ text: typeof i === 'string' ? i : i.text }] }));
  } else {
    instances = [{ parts: [{ text: typeof input === 'string' ? input : input.text }] }];
  }

  const body: Record<string, unknown> = {
    model: params.model || 'embedding-001',
    instances,
  };

  return {
    body,
    headers,
    url: 'https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchPredict',
  };
}

function transformGoogleVertexEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const projectId = (opts.vertexProjectId as string) || '';
  const location = (opts.vertexRegion as string) || 'us-central1';

  const input = params.input;
  let instances;
  if (Array.isArray(input)) {
    instances = input.map(i => ({ content: typeof i === 'string' ? i : i.text }));
  } else {
    instances = [{ content: typeof input === 'string' ? input : input.text }];
  }

  const body: Record<string, unknown> = {
    instances,
  };

  if (params.model) body.model = params.model;

  return {
    body,
    headers,
    url: `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/embedding-004:predict`,
  };
}

function transformGoogleImageRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const projectId = (opts.vertexProjectId as string) || '';
  const location = (opts.vertexRegion as string) || 'us-central1';

  const instances = Array.isArray(params.prompt)
    ? params.prompt.map(text => ({ prompt }))
    : [{ prompt: params.prompt }];

  const parameters: Record<string, unknown> = {};
  if (params.n) parameters.sampleCount = params.n;
  if (params.quality) {
    parameters.outputOptions = {
      compressionQuality: params.quality === 'hd' ? 100 : 75,
    };
  }
  if (params.aspectRatio) parameters.aspectRatio = params.aspectRatio;
  if (params.seed) parameters.seed = params.seed;

  const body: Record<string, unknown> = {
    instances,
    parameters,
  };

  return {
    body,
    headers,
    url: `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate:predict`,
  };
}

function transformBedrockEmbedRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'amazon-bedrock-embedding-provider': params.model || 'amazon.titan-embed-text-v1',
  };

  const input = params.input;
  const texts = Array.isArray(input) ? input.map(i => typeof i === 'string' ? i : i.text) : [typeof input === 'string' ? input : input.text];

  const body: Record<string, unknown> = {
    inputText: Array.isArray(texts) ? texts[0] : texts,
  };

  if (params.model) body.model = params.model;

  return {
    body,
    headers,
    url: 'https://bedrock.us-east-1.amazonaws.com/embeddings',
  };
}

function transformRekaAIRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  const key = (opts.apiKey as string) || '';

  interface RekaMessageItem {
    text: string;
    media_url?: string;
    type: 'human' | 'model';
  }

  const messages: RekaMessageItem[] = [];
  let lastType: 'human' | 'model' | undefined;

  const addMessage = ({
    type,
    text,
    media_url,
  }: {
    type: 'human' | 'model';
    text: string;
    media_url?: string;
  }) => {
    if (media_url && messages[0]?.media_url) {
      return;
    }

    const newMessage: RekaMessageItem = { type, text, media_url };

    if (lastType === type) {
      const placeholder: RekaMessageItem = {
        type: type === 'human' ? 'model' : 'human',
        text: 'Placeholder for alternation',
      };
      media_url
        ? messages.unshift(placeholder)
        : messages.push(placeholder);
    }

    media_url ? messages.unshift(newMessage) : messages.push(newMessage);
    lastType = type;
  };

  params.messages?.forEach((message) => {
    const currentType: 'human' | 'model' = message.role === 'user' ? 'human' : 'model';

    if (!Array.isArray(message.content)) {
      addMessage({ type: currentType, text: message.content || '' });
    } else {
      message.content.forEach((item) => {
        addMessage({
          type: currentType,
          text: item.text || '',
          media_url: item.image_url?.url,
        });
      });
    }
  });

  if (messages[0]?.type !== 'human') {
    messages.unshift({
      type: 'human',
      text: 'Placeholder for alternation',
    });
  }

  const body: Record<string, unknown> = {
    model_name: params.model || 'reka-flash',
    conversation_history: messages,
  };

  if (params.max_tokens) body.request_output_len = params.max_tokens;
  if (params.max_completion_tokens) body.request_output_len = params.max_completion_tokens;
  if (params.temperature) body.temperature = params.temperature;
  if (params.top_p) body.runtime_top_p = params.top_p;
  if (params.seed) body.random_seed = params.seed;
  if (params.frequency_penalty) body.frequency_penalty = params.frequency_penalty;
  if (params.presence_penalty) body.presence_penalty = params.presence_penalty;
  if (params.stop) {
    body.stop_words = Array.isArray(params.stop) ? params.stop : [params.stop];
  }

  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    url: 'https://api.reka.ai/chat',
  };
}