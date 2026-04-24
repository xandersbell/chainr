// Chainr - 全局常量与 Provider 定义

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

// Audio/Speech Provider 常量
export const WHISPER = 'whisper';
export const TTS = 'tts';
export const LEMONFOX = 'lemonfox-ai';
export const NSCALE = 'nscale';

// Audio/Speech URLs
export const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
export const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
export const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
export const LEMONFOX_URL = 'https://api.lemonfox.ai/v1';
export const LEMONFOX_TRANSCRIBE_URL = 'https://api.lemonfox.ai/v1/audio/transcriptions';
export const LEMONFOX_IMAGE_URL = 'https://api.lemonfox.ai/v1/images/generations';
export const WORKERS_AI_EMBED_URL = 'https://api.cloudflare.com/client/v4/ai/v1/embeddings';
export const WORKERS_AI_IMAGE_URL = 'https://api.cloudflare.com/client/v4/ai/v1/images/generations';
export const SILICONFLOW_EMBED_URL = 'https://api.siliconflow.cn/v1/embeddings';
export const SILICONFLOW_IMAGE_URL = 'https://api.siliconflow.cn/v1/images/generations';
export const NSCALE_URL = 'https://api.nscale.io';

// OpenAI-compatible Provider URLs
export const OPENAI_COMPATIBLE_URLS: Record<string, string> = {
  'openai': 'https://api.openai.com/v1/chat/completions',
  'openrouter': 'https://openrouter.ai/api/v1/chat/completions',
  'together-ai': 'https://api.together.ai/v1/chat/completions',
  'perplexity': 'https://api.perplexity.ai/chat/completions',
  'groq': 'https://api.groq.com/openai/v1/chat/completions',
  'deepseek': 'https://api.deepseek.com/chat/completions',
  'mistral-ai': 'https://api.mistral.ai/v1/chat/completions',
  'cohere': 'https://api.cohere.ai/compatibility/v2/chat',
  'dashscope': 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  'cerebras': 'https://api.cerebras.ai/v1/chat/completions',
  'huggingface': 'https://api-inference.huggingface.co/v1/chat/completions',
  'anyscale': 'https://api.endpoints.anyscale.com/v1/chat/completions',
  'ollama': 'http://localhost:11434/v1/chat/completions',
  'fireworks-ai': 'https://api.fireworks.ai/v1/chat/completions',
  'workers-ai': 'https://api.cloudflare.com/client/v4/ai/v1/chat/completions',
  'moonshot': 'https://api.moonshot.cn/v1/chat/completions',
  'lambda': 'https://api.lambda.ai/v1/chat/completions',
  'lingyi': 'https://api.lingyiwanwu.com/v1/chat/completions',
  'zhipu': 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  'novita-ai': 'https://api.novita.ai/v3.5/chat/completions',
  'predibase': 'https://serving.predibase.com/v3/chat/completions',
  'sambanova': 'https://api.sambanova.ai/api/paa/v1/chat/completions',
  'siliconflow': 'https://api.siliconflow.cn/v1/chat/completions',
  'lemonfox-ai': 'https://api.lemonfox.ai/v1/chat/completions',
  'lepton': 'https://api.lepton.ai/api/v1/chat/completions',
  'hyperbolic': 'https://api.hyperbolic.ai/v1/chat/completions',
  '302ai': 'https://api.302.ai/v1/chat/completions',
  'oracle': 'https://inference.oracle.ai/v1/chat/completions',
  'ovhcloud': 'https://auth.api.platform.ovh.net/chat/completions',
  'ncompass': 'https://api.ncompass.com/v1/chat/completions',
  'deepbricks': 'https://api.deepbricks.io/v1/chat/completions',
  'deepinfra': 'https://api.deepinfra.com/v1/chat/completions',
  'azure-openai': '', // Uses custom URL format
  'nebius': 'https://api.nebius.ai/v1/chat/completions',
  'featherless-ai': 'https://api.featherless.ai/v1/chat/completions',
  'ai21': 'https://api.ai21.com/v1/chat/completions',
  'stability-ai': 'https://api.stability.ai/v1/chat/completions',
  'triton': 'https://triton聊天.com/v1/chat/completions',
  'replicate': 'https://api.replicate.com/v1/chat/completions',
  'x-ai': 'https://api.x.ai/v1/chat/completions',
  'modal': 'https://api.modal.com/v1/chat/completions',
  'github': 'https://models.github.ai/inference/chat/completions',
  'azure-ai': '', // Uses custom foundryUrl
  'aibadgr': 'https://api.aibadgr.com/v1/chat/completions',
  'bedrock': '', // AWS Bedrock uses different auth
  'cometapi': 'https://api.comet.com/chat/completions',
  'iointelligence': 'https://api.iointelligence.ai/v1/chat/completions',
  'kluster-ai': 'https://api.kluster.ai/v1/chat/completions',
  'matterai': 'https://api.matter.ai/chat/completions',
  'nextbit': 'https://api.nextbit.ai/v1/chat/completions',
  'sagemaker': '', // AWS SageMaker uses custom endpoints
  'openai-embeddings': 'https://api.openai.com/v1/embeddings',
  'openai-dalle': 'https://api.openai.com/v1/images/generations',
  'workers-ai-embed': 'https://api.cloudflare.com/client/v4/ai/v1/embeddings',
  'workers-ai-image': 'https://api.cloudflare.com/client/v4/ai/v1/images/generations',
  'siliconflow-embed': 'https://api.siliconflow.cn/v1/embeddings',
  'siliconflow-image': 'https://api.siliconflow.cn/v1/images/generations',
  'lemonfox-image': 'https://api.lemonfox.ai/v1/images/generations',
  'nscale': 'https://api.nscale.io/v1/image/generate',
};

// 支持的 Provider 列表
export const VALID_PROVIDERS = [
  OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER,
  TOGETHER_AI, PERPLEXITY, GROQ, DEEPSEEK, MISTRAL_AI, COHERE,
  NOMIC, JINA, VOYAGE,
  SEGMIND, RECRAFT_AI, STABILITY_AI, MESHY, TRIPO3D,
  LEMONFOX, NSCALE
];