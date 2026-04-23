// Chainr - 全局常量与 Provider 定义
// Phase 1: 支持 OpenAI, Anthropic, Google Vertex AI, OpenRouter + 6 个 OpenAI-compatible Provider

export const POWERED_BY: string = 'chainr';

// 重试配置
export const MAX_RETRY_LIMIT_MS = 60 * 1000;
export const RETRY_STATUS_CODES = [429, 500, 502, 503, 504];
export const MAX_RETRIES = 5;

// Provider 常量
export const OPEN_AI = 'openai';
export const ANTHROPIC = 'anthropic';
export const GOOGLE_VERTEX_AI = 'vertex-ai';
export const OPENROUTER = 'openrouter';

// OpenAI-compatible Provider 常量
export const TOGETHER_AI = 'together-ai';
export const PERPLEXITY = 'perplexity';
export const GROQ = 'groq';
export const DEEPSEEK = 'deepseek';
export const MISTRAL_AI = 'mistral-ai';
export const COHERE = 'cohere';

// 支持的 Provider 列表
export const VALID_PROVIDERS = [
  OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER,
  TOGETHER_AI, PERPLEXITY, GROQ, DEEPSEEK, MISTRAL_AI, COHERE
];