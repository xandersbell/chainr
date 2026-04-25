/**
 * Priorai Streaming Support Types
 * Based on OpenAI Chat Completions Streaming API specification
 * Reference: Portkey-ai-gateway streaming implementation patterns
 */

/**
 * OpenAI-format streaming chunk
 * Each chunk corresponds to a single data: {...} line in SSE
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
 * Usage info within a streaming chunk
 * Only included in the final chunk with complete usage
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
 * Choice within a streaming chunk
 */
export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason: string | null;
  logprobs?: null;
}

/**
 * Delta content within a streaming chunk
 * Contains incremental content (not a complete message)
 */
export interface ChatCompletionDelta {
  role?: 'assistant' | 'system' | 'user' | 'tool' | 'function';
  content?: string | null;
  tool_calls?: ChatCompletionToolCallDelta[];
  /** Anthropic content blocks (non-standard) */
  content_blocks?: ContentBlockDelta[];
}

/**
 * Incremental update for a tool call
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
 * Incremental update for an Anthropic content block
 * Used in non-standard OpenAI-compatible mode
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
 * Anthropic streaming state
 * Maintained across multiple chunks
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
 * SSE delimiter types
 * Different providers use different delimiters
 */
export type SplitPatternType = '\n\n' | '\r\n\r\n' | '\n' | '\r\n' | ' ';

export type StreamTransformFn = (
  chunk: string,
  fallbackId: string,
  streamState: Record<string, unknown>,
  strictOpenAiCompliance?: boolean,
  provider?: string,
) => string | undefined;

/**
 * Stream Result
 * Used to return streaming results
 */
export interface StreamResult {
  stream: ReadableStream<ChatCompletionChunk>;
  provider: string;
}

/**
 * Split Pattern mapping supported by providers
 */
export const PROVIDER_SPLIT_PATTERNS: Record<string, SplitPatternType> = {
  openai: '\n\n',
  openrouter: '\n\n',
  'together-ai': '\n\n',
  perplexity: '\r\n\r\n',
  groq: '\n\n',
  deepseek: '\n\n',
  'mistral-ai': '\n\n',
  cohere: '\n\n',
  anthropic: '\n\n', // /v1/messages uses \n\n
  'vertex-ai': '\r\n\r\n',
  google: '\r\n',
  'azure-openai': '\n\n',
  cerebras: '\n\n',
  upstage: '\n\n',
  'reka-ai': '\n\n',
  'monster-api': '\n\n',
  'inference-net': '\n\n',
  nscale: '\n\n',
  dashscope: '\n\n',
  deepbricks: '\n\n',
  lambda: '\n\n',
  siliconflow: '\n\n',
  'x-ai': '\n\n',
  modal: '\n\n',
  github: '\n\n',
  'azure-ai': '\n\n',
  aibadgr: '\n\n',
  bedrock: '\n\n',
  cometapi: '\n\n',
  iointelligence: '\n\n',
  'kluster-ai': '\n\n',
  matterai: '\n\n',
  nextbit: '\n\n',
  sagemaker: '\n\n',
  'z-ai': '\n\n',
};

/**
 * Detect whether a provider is OpenAI-compatible
 * These providers use the standard OpenAI SSE format and can be passed through directly
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
  'z-ai',
];

export function isOpenAICompatibleProvider(provider: string): boolean {
  return OPENAI_COMPATIBLE_PROVIDERS.includes(provider);
}
