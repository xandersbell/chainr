/**
 * Chainr Streaming Support Types
 * 基于 OpenAI Chat Completions Streaming API 规范
 * 参考: Portkey-ai-gateway streaming 实现模式
 */

/**
 * OpenAI 格式的 Streaming Chunk
 * 每个 chunk 对应 SSE 中的一个 data: {...} 行
 */
export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: StreamUsage;
  provider?: string;
  system_fingerprint?: string;
}

/**
 * Streaming chunk 中的 usage 信息
 * 仅在最终 chunk 中包含完整 usage
 */
export interface StreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/**
 * Streaming chunk 中的 choice
 */
export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason: string | null;
  logprobs?: null;
}

/**
 * Streaming chunk 中的 delta 内容
 * 包含增量内容（而非完整消息）
 */
export interface ChatCompletionDelta {
  role?: 'assistant' | 'system' | 'user' | 'tool' | 'function';
  content?: string | null;
  tool_calls?: ChatCompletionToolCallDelta[];
  /** Anthropic content blocks (non-standard) */
  content_blocks?: ContentBlockDelta[];
}

/**
 * Tool call 的增量更新
 */
export interface ChatCompletionToolCallDelta {
  index: number;
  id?: string;
  type: 'function';
  function: {
    name?: string;
    arguments?: string;
  };
}

/**
 * Anthropic content block 的增量更新
 * 用于非标准 OpenAI 兼容模式
 */
export interface ContentBlockDelta {
  index: number;
  delta: {
    text?: string;
    thinking?: string;
    signature?: string;
    data?: string;
    partial_json?: string;
  };
}

/**
 * Anthropic Streaming 状态
 * 在多次 chunk 之间保持状态
 */
export interface AnthropicStreamState {
  toolIndex: number;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

/**
 * SSE 分割符类型
 * 不同 provider 使用不同的分割符
 */
export type SplitPatternType = '\n\n' | '\r\n\r\n' | '\n' | '\r\n' | ' ';

export type StreamTransformFn = (
  chunk: string,
  fallbackId: string,
  streamState: Record<string, unknown>,
  strictOpenAiCompliance?: boolean,
  provider?: string
) => string | undefined;

/**
 * Stream Result
 * 用于返回 streaming 结果
 */
export interface StreamResult {
  stream: ReadableStream<ChatCompletionChunk>;
  provider: string;
}

/**
 * Provider 支持的 Split Pattern 映射
 */
export const PROVIDER_SPLIT_PATTERNS: Record<string, SplitPatternType> = {
  'openai': '\n\n',
  'openrouter': '\n\n',
  'together-ai': '\n\n',
  'perplexity': '\r\n\r\n',
  'groq': '\n\n',
  'deepseek': '\n\n',
  'mistral-ai': '\n\n',
  'cohere': '\n\n',
  'anthropic': '\n\n',  // /v1/messages 使用 \n\n
  'vertex-ai': '\r\n\r\n',
  'google': '\r\n',
  'azure-openai': '\n\n',
  'cerebras': '\n\n',
  'upstage': '\n\n',
  'reka-ai': '\n\n',
  'monster-api': '\n\n',
  'inference-net': '\n\n',
  'nscale': '\n\n',
  'dashscope': '\n\n',
  'deepbricks': '\n\n',
  'lambda': '\n\n',
  'siliconflow': '\n\n',
  'x-ai': '\n\n',
  'modal': '\n\n',
  'github': '\n\n',
  'azure-ai': '\n\n',
  'aibadgr': '\n\n',
  'bedrock': '\n\n',
  'cometapi': '\n\n',
  'iointelligence': '\n\n',
  'kluster-ai': '\n\n',
  'matterai': '\n\n',
  'nextbit': '\n\n',
  'sagemaker': '\n\n',
};

/**
 * 检测是否为 OpenAI-compatible provider
 * 这些 provider 使用标准 OpenAI SSE 格式，可以直接 passthrough
 */
export const OPENAI_COMPATIBLE_PROVIDERS = [
  'openai',
  'openrouter',
  'together-ai',
  'perplexity',
  'groq',
  'deepseek',
  'mistral-ai',
  'cohere',
  'dashscope',
  'cerebras',
  'huggingface',
  'anyscale',
  'ollama',
  'fireworks-ai',
  'workers-ai',
  'moonshot',
  'lambda',
  'lingyi',
  'zhipu',
  'novita-ai',
  'predibase',
  'sambanova',
  'siliconflow',
  'lemonfox-ai',
  'lepton',
  'hyperbolic',
  '302ai',
  'oracle',
  'ovhcloud',
  'ncompass',
  'deepbricks',
  'deepinfra',
  'azure-openai',
  'nebius',
  'featherless-ai',
  'ai21',
  'stability-ai',
  'triton',
  'replicate',
  'x-ai',
  'modal',
  'github',
  'azure-ai',
  'aibadgr',
  'bedrock',
  'cometapi',
  'iointelligence',
  'kluster-ai',
  'matterai',
  'nextbit',
  'sagemaker',
];

export function isOpenAICompatibleProvider(provider: string): boolean {
  return OPENAI_COMPATIBLE_PROVIDERS.includes(provider);
}