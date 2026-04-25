// Priorai - Global constants and Provider definitions
// Aligned with Portkey's src/globals.ts to ensure all provider file imports resolve

import type { endpointStrings } from './providers/types';

export const POWERED_BY: string = 'priorai';

// Retry configuration
export const MAX_RETRY_LIMIT_MS = 60 * 1000;
export const RETRY_STATUS_CODES = [429, 500, 502, 503, 504];
export const MAX_RETRIES = 5;

// Provider name constants (aligned with Portkey)
export const OPEN_AI: string = 'openai';
export const COHERE: string = 'cohere';
export const AZURE_OPEN_AI: string = 'azure-openai';
export const AZURE_AI_INFERENCE: string = 'azure-ai';
export const ANTHROPIC: string = 'anthropic';
export const ANYSCALE: string = 'anyscale';
export const PALM: string = 'palm';
export const TOGETHER_AI: string = 'together-ai';
export const GOOGLE: string = 'google';
export const GOOGLE_VERTEX_AI: string = 'vertex-ai';
export const HUGGING_FACE: string = 'huggingface';
export const PERPLEXITY_AI: string = 'perplexity-ai';
export const REKA_AI: string = 'reka-ai';
export const MISTRAL_AI: string = 'mistral-ai';
export const DEEPINFRA: string = 'deepinfra';
export const NCOMPASS: string = 'ncompass';
export const STABILITY_AI: string = 'stability-ai';
export const NOMIC: string = 'nomic';
export const OLLAMA: string = 'ollama';
export const AI21: string = 'ai21';
export const BEDROCK: string = 'bedrock';
export const GROQ: string = 'groq';
export const SEGMIND: string = 'segmind';
export const JINA: string = 'jina';
export const FIREWORKS_AI: string = 'fireworks-ai';
export const WORKERS_AI: string = 'workers-ai';
export const MOONSHOT: string = 'moonshot';
export const OPENROUTER: string = 'openrouter';
export const LINGYI: string = 'lingyi';
export const ZHIPU: string = 'zhipu';
export const NOVITA_AI: string = 'novita-ai';
export const MONSTERAPI: string = 'monsterapi';
export const DEEPSEEK: string = 'deepseek';
export const PREDIBASE: string = 'predibase';
export const TRITON: string = 'triton';
export const VOYAGE: string = 'voyage';
export const GITHUB: string = 'github';
export const DEEPBRICKS: string = 'deepbricks';
export const SILICONFLOW: string = 'siliconflow';
export const CEREBRAS: string = 'cerebras';
export const INFERENCENET: string = 'inference-net';
export const SAMBANOVA: string = 'sambanova';
export const LEMONFOX_AI: string = 'lemonfox-ai';
export const UPSTAGE: string = 'upstage';
export const LAMBDA: string = 'lambda';
export const DASHSCOPE: string = 'dashscope';
export const X_AI: string = 'x-ai';
export const CORTEX: string = 'cortex';
export const SAGEMAKER: string = 'sagemaker';
export const NEBIUS: string = 'nebius';
export const RECRAFTAI: string = 'recraft-ai';
export const REPLICATE: string = 'replicate';
export const LEPTON: string = 'lepton';
export const KLUSTER_AI: string = 'kluster-ai';
export const NSCALE: string = 'nscale';
export const HYPERBOLIC: string = 'hyperbolic';
export const BYTEZ: string = 'bytez';
export const FEATHERLESS_AI: string = 'featherless-ai';
export const KRUTRIM: string = 'krutrim';
export const THREE_ZERO_TWO_AI: string = '302ai';
export const COMETAPI: string = 'cometapi';
export const MATTERAI: string = 'matterai';
export const MESHY: string = 'meshy';
export const TRIPO3D: string = 'tripo3d';
export const NEXTBIT: string = 'nextbit';
export const MODAL: string = 'modal';
export const Z_AI: string = 'z-ai';
export const ORACLE: string = 'oracle';
export const IO_INTELLIGENCE: string = 'iointelligence';
export const AIBADGR: string = 'aibadgr';
export const OVHCLOUD: string = 'ovhcloud';
export const DATABRICKS: string = 'databricks';
export const LATITUDE: string = 'latitude';

// Legacy aliases for backward compatibility
export const PERPLEXITY = PERPLEXITY_AI;
export const LEMONFOX = LEMONFOX_AI;
export const RECRAFT_AI = RECRAFTAI;
export const WHISPER = 'whisper';
export const TTS = 'tts';

// Embeddings/Image/Audio specific URL constants
export const JINA_URL = 'https://api.jina.ai';
export const NOMIC_URL = 'https://api.nomic.ai';
export const VOYAGE_URL = 'https://api.voyageai.com';
export const SEGMIND_URL = 'https://api.segmind.com';
export const RECRAFT_AI_URL = 'https://api.recraft.ai';
export const STABILITY_AI_URL = 'https://api.stability.ai';
export const MESHY_URL = 'https://api.meshy.ai';
export const TRIPO3D_URL = 'https://api.tripo3d.ai';
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

// OpenAI-compatible Provider URLs (used by provider registry)
export const OPENAI_COMPATIBLE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  'together-ai': 'https://api.together.ai/v1/chat/completions',
  'perplexity-ai': 'https://api.perplexity.ai/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  'mistral-ai': 'https://api.mistral.ai/v1/chat/completions',
  cohere: 'https://api.cohere.ai/compatibility/v2/chat',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  cerebras: 'https://api.cerebras.ai/v1/chat/completions',
  huggingface: 'https://api-inference.huggingface.co/v1/chat/completions',
  anyscale: 'https://api.endpoints.anyscale.com/v1/chat/completions',
  ollama: 'http://localhost:11434/v1/chat/completions',
  'fireworks-ai': 'https://api.fireworks.ai/v1/chat/completions',
  'workers-ai': 'https://api.cloudflare.com/client/v4/ai/v1/chat/completions',
  moonshot: 'https://api.moonshot.cn/v1/chat/completions',
  lambda: 'https://api.lambda.ai/v1/chat/completions',
  lingyi: 'https://api.lingyiwanwu.com/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  'novita-ai': 'https://api.novita.ai/v3.5/chat/completions',
  predibase: 'https://serving.predibase.com/v3/chat/completions',
  sambanova: 'https://api.sambanova.ai/api/paa/v1/chat/completions',
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
  'lemonfox-ai': 'https://api.lemonfox.ai/v1/chat/completions',
  lepton: 'https://api.lepton.ai/api/v1/chat/completions',
  hyperbolic: 'https://api.hyperbolic.ai/v1/chat/completions',
  '302ai': 'https://api.302.ai/v1/chat/completions',
  oracle: 'https://inference.oracle.ai/v1/chat/completions',
  ovhcloud: 'https://auth.api.platform.ovh.net/chat/completions',
  ncompass: 'https://api.ncompass.com/v1/chat/completions',
  deepbricks: 'https://api.deepbricks.io/v1/chat/completions',
  deepinfra: 'https://api.deepinfra.com/v1/chat/completions',
  'azure-openai': '',
  nebius: 'https://api.nebius.ai/v1/chat/completions',
  'featherless-ai': 'https://api.featherless.ai/v1/chat/completions',
  ai21: 'https://api.ai21.com/v1/chat/completions',
  'stability-ai': 'https://api.stability.ai/v1/chat/completions',
  triton: '',
  replicate: 'https://api.replicate.com/v1/chat/completions',
  'x-ai': 'https://api.x.ai/v1/chat/completions',
  modal: 'https://api.modal.com/v1/chat/completions',
  github: 'https://models.github.ai/inference/chat/completions',
  'azure-ai': '',
  aibadgr: 'https://api.aibadgr.com/v1/chat/completions',
  bedrock: '',
  cometapi: 'https://api.comet.com/chat/completions',
  iointelligence: 'https://api.iointelligence.ai/v1/chat/completions',
  'kluster-ai': 'https://api.kluster.ai/v1/chat/completions',
  matterai: 'https://api.matter.ai/chat/completions',
  nextbit: 'https://api.nextbit.ai/v1/chat/completions',
  sagemaker: '',
  monsterapi: 'https://llm.monsterapi.ai/v1/chat/completions',
  'z-ai': 'https://api.z.ai/api/paas/v4/chat/completions',
  'reka-ai': 'https://api.reka.ai/chat',
  krutrim: 'https://cloud.olakrutrim.com/v1/chat/completions',
  upstage: 'https://api.upstage.ai/v1/solar/chat/completions',
  cortex: '',
};

// Embeddings/Image/Audio specific URL mappings (used by provider registry)
export const OPENAI_COMPATIBLE_EMBED_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/embeddings',
  'workers-ai': 'https://api.cloudflare.com/client/v4/ai/v1/embeddings',
  siliconflow: 'https://api.siliconflow.cn/v1/embeddings',
  ai21: 'https://api.ai21.com/v1/embeddings',
  'mistral-ai': 'https://api.mistral.ai/v1/embeddings',
  'together-ai': 'https://api.together.ai/v1/embeddings',
  anyscale: 'https://api.endpoints.anyscale.com/v1/embeddings',
  'fireworks-ai': 'https://api.fireworks.ai/v1/embeddings',
  deepbricks: 'https://api.deepbricks.io/v1/embeddings',
};

export const OPENAI_COMPATIBLE_IMAGE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/images/generations',
  'workers-ai': 'https://api.cloudflare.com/client/v4/ai/v1/images/generations',
  siliconflow: 'https://api.siliconflow.cn/v1/images/generations',
  'lemonfox-ai': 'https://api.lemonfox.ai/v1/images/generations',
  deepbricks: 'https://api.deepbricks.io/v1/images/generations',
  hyperbolic: 'https://api.hyperbolic.ai/v1/images/generations',
  nscale: 'https://api.nscale.io/v1/image/generate',
};

// Portkey-aligned content type constants
export const CONTENT_TYPES = {
  APPLICATION_JSON: 'application/json',
  MULTIPART_FORM_DATA: 'multipart/form-data',
  EVENT_STREAM: 'text/event-stream',
  AUDIO_MPEG: 'audio/mpeg',
  APPLICATION_OCTET_STREAM: 'application/octet-stream',
  BINARY_OCTET_STREAM: 'binary/octet-stream',
  GENERIC_AUDIO_PATTERN: 'audio',
  PLAIN_TEXT: 'text/plain',
  HTML: 'text/html',
  GENERIC_IMAGE_PATTERN: 'image/',
};

export const MULTIPART_FORM_DATA_ENDPOINTS: endpointStrings[] = [
  'createTranscription',
  'createTranslation',
  'uploadFile',
];

export const fileExtensionMimeTypeMap = {
  mp4: 'video/mp4',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  webp: 'image/webp',
  pdf: 'application/pdf',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  html: 'text/html',
  md: 'text/markdown',
  mp3: 'audio/mp3',
  wav: 'audio/wav',
  txt: 'text/plain',
  mov: 'video/mov',
  mpeg: 'video/mpeg',
  mpg: 'video/mpg',
  avi: 'video/avi',
  wmv: 'video/wmv',
  mpegps: 'video/mpegps',
  flv: 'video/flv',
  webm: 'video/webm',
  mkv: 'video/mkv',
  threegpp: 'video/three_gpp',
};

export const imagesMimeTypes = [
  fileExtensionMimeTypeMap.jpeg,
  fileExtensionMimeTypeMap.jpg,
  fileExtensionMimeTypeMap.png,
  fileExtensionMimeTypeMap.bmp,
  fileExtensionMimeTypeMap.tiff,
  fileExtensionMimeTypeMap.webp,
];

export const documentMimeTypes = [
  fileExtensionMimeTypeMap.pdf,
  fileExtensionMimeTypeMap.csv,
  fileExtensionMimeTypeMap.doc,
  fileExtensionMimeTypeMap.docx,
  fileExtensionMimeTypeMap.xls,
  fileExtensionMimeTypeMap.xlsx,
  fileExtensionMimeTypeMap.html,
  fileExtensionMimeTypeMap.md,
  fileExtensionMimeTypeMap.txt,
];

export const videoMimeTypes = [
  fileExtensionMimeTypeMap.mkv,
  fileExtensionMimeTypeMap.mov,
  fileExtensionMimeTypeMap.mp4,
  fileExtensionMimeTypeMap.webm,
  fileExtensionMimeTypeMap.flv,
  fileExtensionMimeTypeMap.mpeg,
  fileExtensionMimeTypeMap.mpg,
  fileExtensionMimeTypeMap.wmv,
  fileExtensionMimeTypeMap.threegpp,
  fileExtensionMimeTypeMap.avi,
];

export enum BatchEndpoints {
  CHAT_COMPLETIONS = '/v1/chat/completions',
  COMPLETIONS = '/v1/completions',
  EMBEDDINGS = '/v1/embeddings',
}
