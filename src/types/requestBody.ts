interface RetrySettings {
  attempts: number;
  onStatusCodes: number[];
  useRetryAfterHeader?: boolean;
}

interface CacheSettings {
  mode: string;
  maxAge?: number;
}

export type StrategyModes = 'loadbalance' | 'fallback' | 'single' | 'conditional';

export interface Options {
  provider: string;
  virtualKey?: string;
  apiKey?: string;
  weight?: number;
  retry?: RetrySettings;
  overrideParams?: Params;
  urlToFetch?: string;
  customHost?: string;
  forwardHeaders?: string[];
  index?: number;
  cache?: CacheSettings | string;
  metadata?: Record<string, string>;
  requestTimeout?: number;
  openaiProject?: string;
  openaiOrganization?: string;
  openaiBeta?: string;
  vertexRegion?: string;
  vertexProjectId?: string;
  vertexServiceAccountJson?: Record<string, unknown>;
  vertexStorageBucketName?: string;
  vertexModelName?: string;
  anthropicBeta?: string;
  anthropicVersion?: string;
  anthropicApiKey?: string;
  // AWS Bedrock / SageMaker
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
  awsAuthType?: string;
  awsService?: string;
  awsRoleArn?: string;
  awsExternalId?: string;
  awsS3Bucket?: string;
  awsServerSideEncryption?: string;
  awsServerSideEncryptionKMSKeyId?: string;
  foundationModel?: string;
  amznSagemakerCustomAttributes?: string;
  amznSagemakerEnableExplanations?: string;
  amznSagemakerInferenceComponent?: string;
  amznSagemakerInferenceId?: string;
  amznSagemakerSessionId?: string;
  amznSagemakerTargetContainerHostname?: string;
  amznSagemakerTargetModel?: string;
  amznSagemakerTargetVariant?: string;
  // Azure OpenAI
  resourceName?: string;
  deploymentId?: string;
  apiVersion?: string;
  azureAdToken?: string;
  azureAuthMode?: string;
  azureEntraTenantId?: string;
  azureEntraClientId?: string;
  azureEntraClientSecret?: string;
  azureEntraScope?: string;
  azureManagedClientId?: string;
  azureWorkloadClientId?: string;
  // Azure AI Inference
  azureFoundryUrl?: string;
  azureDeploymentName?: string;
  azureApiVersion?: string;
  azureExtraParameters?: string;
  // Fireworks AI
  fireworksAccountId?: string;
  // Hugging Face
  huggingfaceBaseUrl?: string;
  // Workers AI
  workersAiAccountId?: string;
  // Mistral
  mistralFimCompletion?: string;
  // Oracle
  oracleApiVersion?: string;
  oracleCompartmentId?: string;
  oracleFingerprint?: string;
  oracleKeyPassphrase?: string;
  oraclePrivateKey?: string;
  oracleRegion?: string;
  oracleServingMode?: string;
  oracleTenancy?: string;
  oracleUser?: string;
}

export interface Targets {
  name?: string;
  strategy?: Record<string, unknown>;
  provider?: string;
  virtualKey?: string;
  apiKey?: string;
  weight?: number;
  retry?: RetrySettings;
  overrideParams?: Params;
  urlToFetch?: string;
  index?: number;
  cache?: CacheSettings | string;
  targets?: Targets[];
  transformToFormData?: boolean;
  originalIndex?: number;
}

export interface Config {
  mode: 'single' | 'fallback' | 'loadbalance' | 'scientist';
  options?: Options[];
  targets?: Targets[];
  cache?: CacheSettings;
  retry?: RetrySettings;
  strategy?: Record<string, unknown>;
  customHost?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool' | 'developer';
  content?: string | ContentType[];
  content_blocks?: ContentType[];
  name?: string;
  function_call?: unknown;
  tool_calls?: unknown;
  tool_call_id?: string;
  citationMetadata?: CitationMetadata;
  reasoning_details?: unknown[];
}

export interface ContentType {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  image_url?: {
    url: string;
    detail?: string;
    mime_type?: string;
  };
  data?: string;
  file?: {
    file_data?: string;
    file_id?: string;
    file_name?: string;
    file_url?: string;
    mime_type?: string;
  };
  input_audio?: {
    data: string;
    format: 'mp3' | 'wav' | string;
  };
  cache_control?: { type: 'ephemeral' };
}

export interface CitationMetadata {
  citationSources?: CitationSource[];
}

export interface CitationSource {
  startIndex?: number;
  endIndex?: number;
  uri?: string;
  license?: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
    description?: string;
    thought_signature?: string;
  };
}

export interface Function {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  strict?: boolean;
  defer_loading?: boolean;
  allowed_callers?: string[];
  input_examples?: Record<string, unknown>[];
}

export interface ToolChoiceObject {
  type: string;
  function: {
    name: string;
  };
}

export interface CustomToolChoice {
  type: 'custom';
  custom: {
    name?: string;
  };
}

export type ToolChoice = ToolChoiceObject | CustomToolChoice | 'none' | 'auto' | 'required';

export interface Tool {
  type: string;
  function?: Function;
  cache_control?: { type: 'ephemeral' };
  [key: string]: unknown;
}

export interface Params {
  model?: string;
  prompt?: string | string[];
  input?: string | string[] | EmbedInput[];
  messages?: Message[];
  functions?: Function[];
  function_call?: 'none' | 'auto' | { name: string };
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  logprobs?: number;
  top_logprobs?: boolean;
  echo?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  best_of?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  context?: string;
  top_k?: number;
  tools?: Tool[];
  tool_choice?: ToolChoice;
  reasoning_effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | string;
  response_format?: {
    type: 'json_object' | 'text' | 'json_schema';
    json_schema?: unknown;
  } | string;
  seed?: number;
  store?: boolean;
  metadata?: object;
  modalities?: string[];
  audio?: {
    voice: string;
    format: string;
  };
  service_tier?: string;
  prediction?: {
    type: string;
    content:
      | {
          type: string;
          text: string;
        }[]
      | string;
  };
  safety_settings?: unknown;
  anthropic_beta?: string;
  anthropic_version?: string;
  thinking?: {
    type?: string;
    budget_tokens: number;
  };
  dimensions?: number;
  parameters?: unknown;
  // 图片生成
  size?: string;
  quality?: string;
  style?: string;
  // 音频转录/翻译
  file?: File | Blob | string;
  language?: string;
  // TTS
  voice?: string;
  speed?: number;
  // Embeddings
  encoding_format?: string;
  // SiliconFlow 图片
  num_steps?: number;
  guidance?: number;
  // Google Imagen
  aspectRatio?: string;
  // 其他
  version?: string;
  examples?: unknown[];
}

export interface ShortConfig {
  provider: string;
  virtualKey?: string;
  apiKey?: string;
  cache?: CacheSettings;
  retry?: RetrySettings;
  resourceName?: string;
  deploymentId?: string;
  workersAiAccountId?: string;
  apiVersion?: string;
  azureAuthMode?: string;
  azureManagedClientId?: string;
  azureEntraClientId?: string;
  azureEntraClientSecret?: string;
  azureEntraTenantId?: string;
  azureModelName?: string;
  customHost?: string;
  vertexRegion?: string;
  vertexProjectId?: string;
}

export type RequestBody = {
  config: Config;
  params: Params;
} | {
  config: ShortConfig;
  params: Params;
};

// ============================================================================
// Embeddings Types
// ============================================================================

export interface EmbedInput {
  text?: string;
  image?: {
    url?: string;
    base64?: string;
  };
}

export interface EmbedParams {
  model?: string;
  input: string | string[] | EmbedInput[];
  user?: string;
  dimensions?: number;
  encoding_format?: 'float' | 'base64';
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

// ============================================================================
// Image Generation Types
// ============================================================================

export interface ImageGenerateParams {
  model?: string;
  prompt: string;
  n?: number;
  quality?: 'standard' | 'hd';
  size?: string;
  style?: string;
  response_format?: 'b64_json' | 'url';
  seed?: number;
  user?: string;
}

export interface ImageGenerateResponseData {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
}

export interface ImageGenerateResponse {
  created: number;
  data: ImageGenerateResponseData[];
  provider?: string;
}

// ============================================================================
// Audio Transcription Types
// ============================================================================

export interface TranscriptionParams {
  file: File | Blob | string;  // Audio file or base64
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  timeout?: number;
}

export interface TranslationParams {
  file: File | Blob | string;
  model?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

// ============================================================================
// Speech Synthesis Types
// ============================================================================

export interface SpeechParams {
  model?: string;
  input: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac';
  speed?: number;
}

export interface SpeechResponse {
  audio_data: Buffer | Uint8Array;
  content_type: string;
}

// ============================================================================
// 3D Generation Types
// ============================================================================

export interface Model3DGenerateParams {
  model?: string;
  prompt: string;
  mesh_format?: 'obj' | 'glb' | 'fbx';
  texture_format?: 'png' | 'jpg';
}

export interface Model3DGenerateResponse {
  task_id: string;
  status: string;
  model_url?: string;
  provider?: string;
}

// Provider 需要的类型常量和别名
export const SYSTEM_MESSAGE_ROLES = ['system', 'developer'] as const;
export const MESSAGE_ROLES = ['system', 'user', 'assistant', 'function', 'tool', 'developer'] as const;
export type OpenAIMessageRole = (typeof MESSAGE_ROLES)[number];

export interface ContentBlockChunk {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
  };
}

export interface PromptCache {
  type: 'ephemeral';
}

export type JsonSchema = Record<string, unknown>;