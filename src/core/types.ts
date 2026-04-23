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
}

export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: UsageStats;
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
  body: Record<string, unknown>;
  headers: Record<string, string>;
  url: string;
}

export interface RetryResult {
  success: boolean;
  response?: Record<string, unknown>;
  error?: string;
}

export interface StrategyResult {
  success: boolean;
  response?: Record<string, unknown>;
  provider?: string;
  error?: string;
}

export interface ChainrConfig {
  strategy: 'fallback' | 'loadbalance' | 'single';
  targets: Array<Record<string, unknown>>;
  retry?: {
    attempts: number;
    onStatusCodes: number[];
  };
}