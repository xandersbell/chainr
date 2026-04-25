export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: string;
  logprobs?: unknown;
}

export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    audio_tokens?: number;
    cached_tokens?: number;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: UsageStats;
  provider?: string;
}

export interface ProviderError {
  message: string;
  type: string;
  param: string | null;
  code: string | null;
  provider?: string;
}

export interface ErrorResponse {
  error: ProviderError;
}

export interface TransformResult {
  body: Record<string, unknown> | FormData;
  headers: Record<string, string>;
  url: string;
  isFormData?: boolean;
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
}

export interface RetryResult {
  success: boolean;
  response?: Record<string, unknown>;
  error?: string;
}

export interface RetryResultForStream {
  success: boolean;
  response?: Response;
  error?: string;
}

export interface StrategyResult {
  success: boolean;
  response?: Record<string, unknown>;
  provider?: string;
  error?: string;
}

export interface BinaryResult {
  success: boolean;
  data?: ArrayBuffer;
  contentType?: string;
  error?: string;
}

/**
 * 目标配置 — 可以是叶节点（有 provider）或嵌套策略组（有 strategy + targets）
 * 两者互斥：叶节点必须有 provider，策略组必须有 strategy + targets
 */
export interface TargetConfig {
  // 叶节点字段
  provider?: string;
  apiKey?: string;
  weight?: number;
  retry?: { attempts?: number; onStatusCodes?: number[] };
  overrideParams?: Record<string, unknown>;
  // 嵌套策略字段
  strategy?: 'fallback' | 'loadbalance' | 'single';
  targets?: TargetConfig[];
  // 超时（可在任意层级设置，子级覆盖父级）
  timeout?: number;
  // conditional routing 用的 target 名称
  name?: string;
  // 其他 provider 特定字段透传
  [key: string]: unknown;
}

export interface PrioraiConfig {
  strategy: 'fallback' | 'loadbalance' | 'single' | 'conditional';
  targets: TargetConfig[];
  embedTargets?: TargetConfig[];
  imageTargets?: TargetConfig[];
  audioTargets?: TargetConfig[];
  speechTargets?: TargetConfig[];
  // Anthropic Messages API 专用 targets（可选，默认复用 targets）
  messagesTargets?: TargetConfig[];
  // OpenAI Responses API 专用 targets（可选，默认复用 targets）
  responsesTargets?: TargetConfig[];
  retry?: {
    attempts: number;
    onStatusCodes: number[];
  };
  timeout?: number;
  // conditional routing 配置
  conditions?: import('./strategies/ConditionalStrategy').ConditionConfig[];
  conditionalDefault?: string;
  metadata?: Record<string, string>;
}

export interface EmbedResponseData {
  object: string;
  embedding?: number[] | number[][];
  index: number;
}

export interface EmbedResponse {
  object: string;
  data: EmbedResponseData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  provider?: string;
}

export interface ImageGenerateResponse {
  created: number;
  data: {
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }[];
  provider?: string;
}

export interface Model3DGenerateResponse {
  task_id: string;
  status: string;
  model_url?: string;
  provider?: string;
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

export interface SpeechResponse {
  audio_data: ArrayBuffer;
  contentType: string;
}