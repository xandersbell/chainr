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

// Embeddings Provider 常量
export const NOMIC = 'nomic';
export const JINA = 'jina';
export const VOYAGE = 'voyage';
export const JINA_URL = 'https://api.jina.ai';
export const NOMIC_URL = 'https://api.nomic.ai';
export const VOYAGE_URL = 'https://api.voyageai.com';

// Image/3D Provider 常量
export const SEGMIND = 'segmind';
export const RECRAFT_AI = 'recraft-ai';
export const STABILITY_AI = 'stability-ai';
export const MESHY = 'meshy';
export const TRIPO3D = 'tripo3d';
export const SEGMIND_URL = 'https://api.segmind.com';
export const RECRAFT_AI_URL = 'https://api.recraft.ai';
export const STABILITY_AI_URL = 'https://api.stability.ai';
export const MESHY_URL = 'https://api.meshy.ai';
export const TRIPO3D_URL = 'https://api.tripo3d.ai';

// 支持的 Provider 列表
export const VALID_PROVIDERS = [
  OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER,
  TOGETHER_AI, PERPLEXITY, GROQ, DEEPSEEK, MISTRAL_AI, COHERE,
  NOMIC, JINA, VOYAGE,
  SEGMIND, RECRAFT_AI, STABILITY_AI, MESHY, TRIPO3D
];