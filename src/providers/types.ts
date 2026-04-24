// 从 Portkey 的 src/providers/types.ts 适配而来
// 移除了 Hono Context 依赖和 Batch/Finetune/File 相关类型

import { Message, Options, Params } from '../types/requestBody';
import { ANTHROPIC_STOP_REASON } from './anthropic/types';
import {
  BEDROCK_CONVERSE_STOP_REASON,
  TITAN_STOP_REASON,
} from './bedrock/types';
import { VERTEX_GEMINI_GENERATE_CONTENT_FINISH_REASON } from './google-vertex-ai/types';
import { DEEPSEEK_STOP_REASON } from './deepseek/types';
import { MISTRAL_AI_FINISH_REASON } from './mistral-ai/types';
import { TOGETHER_AI_FINISH_REASON } from './together-ai/types';
import { COHERE_STOP_REASON } from './cohere/types';

/**
 * 参数配置接口
 */
export interface ParameterConfig {
  /** provider 转换后的参数键名 */
  param: string;
  /** 默认值 */
  default?: any;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 是否必需 */
  required?: boolean;
  /** 参数值转换函数 */
  transform?: (params: any, providerOptions: Options) => any;
}

/**
 * 单个 Provider 的参数映射配置
 */
export interface ProviderConfig {
  [key: string]: ParameterConfig | ParameterConfig[];
}

/**
 * Provider API 配置接口
 * 注意：相比 Portkey 移除了所有 `c: Context` (Hono) 参数
 */
export interface ProviderAPIConfig {
  /** 生成请求头 */
  headers: (args: {
    providerOptions: Options;
    fn: string;
    transformedRequestBody: Record<string, any>;
    transformedRequestUrl: string;
    gatewayRequestBody?: Params;
    headers?: Record<string, string>;
  }) => Promise<Record<string, any>> | Record<string, any>;

  /** 生成 baseURL */
  getBaseURL: (args: {
    providerOptions: Options;
    fn?: endpointStrings;
    requestHeaders?: Record<string, string>;
    gatewayRequestURL: string;
    params?: Params;
  }) => Promise<string> | string;

  /** 生成 endpoint 路径 */
  getEndpoint: (args: {
    providerOptions: Options;
    fn: endpointStrings;
    gatewayRequestBodyJSON: Params;
    gatewayRequestBody?: FormData | Params | ArrayBuffer | ReadableStream;
    gatewayRequestURL: string;
  }) => string;

  /** 是否需要转换为 FormData */
  transformToFormData?: (args: { gatewayRequestBody: Params }) => boolean;

  getProxyEndpoint?: (args: {
    providerOptions: Options;
    reqPath: string;
    reqQuery: string;
  }) => string;
}

// Chainr 只保留推理相关的 endpoint 类型
export type endpointStrings =
  | 'complete'
  | 'chatComplete'
  | 'embed'
  | 'rerank'
  | 'moderate'
  | 'stream-complete'
  | 'stream-chatComplete'
  | 'stream-messages'
  | 'proxy'
  | 'imageGenerate'
  | 'imageEdit'
  | 'createSpeech'
  | 'createTranscription'
  | 'createTranslation'
  | 'realtime'
  | 'createModelResponse'
  | 'getModelResponse'
  | 'deleteModelResponse'
  | 'listResponseInputItems'
  | 'messages'
  | 'messagesCountTokens'
  | 'uploadFile'
  | 'retrieveFile'
  | 'listFiles'
  | 'deleteFile'
  | 'retrieveFileContent'
  | 'createFinetune'
  | 'retrieveFinetune'
  | 'listFinetunes'
  | 'cancelFinetune'
  | 'createBatch'
  | 'retrieveBatch'
  | 'listBatches'
  | 'cancelBatch'
  | 'getBatchOutput';

/**
 * Provider API 配置集合
 */
export interface ProviderAPIConfigs {
  [key: string]: ProviderAPIConfig;
}

export type RequestHandler<
  T = Params | FormData | ArrayBuffer | ReadableStream,
> = (args: {
  providerOptions: Options;
  requestURL: string;
  requestHeaders: Record<string, string>;
  requestBody: T;
}) => Promise<Response>;

export type RequestHandlers = Partial<
  Record<endpointStrings, RequestHandler<any>>
>;

/**
 * Provider 完整配置导出（每个 provider 的 index.ts 导出此类型）
 */
export interface ProviderConfigs {
  [key: string]: any;
  requestHandlers?: RequestHandlers;
  getConfig?: (args: {
    params: Params;
    providerOptions: Options;
  }) => any;
}

export interface BaseResponse {
  object: string;
  model: string;
}

/**
 * 基础 completion 响应
 */
export interface CResponse extends BaseResponse {
  id: string;
  created: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: {
      accepted_prediction_tokens?: number;
      audio_tokens?: number;
      reasoning_tokens?: number;
      rejected_prediction_tokens?: number;
    };
    prompt_tokens_details?: {
      audio_tokens?: number;
      cached_tokens?: number;
    };
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    num_search_queries?: number;
  };
}

/**
 * completions 响应
 */
export interface CompletionResponse extends CResponse {
  choices: {
    text: string;
    index: number;
    logprobs: null;
    finish_reason: string;
  }[];
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  searchEntryPoint?: {
    renderedContent: string;
  };
  groundingSupports?: Array<{
    segment: {
      startIndex: number;
      endIndex: number;
      text: string;
    };
    groundingChunkIndices: number[];
    confidenceScores: number[];
  }>;
  retrievalMetadata?: {
    webDynamicRetrievalScore: number;
  };
}

/**
 * chat completion 响应中的 choice
 */
export interface ChatChoice {
  index: number;
  message: Message;
  finish_reason: string;
  logprobs?: object | null;
  groundingMetadata?: GroundingMetadata;
}

export interface Logprobs {
  token: string;
  logprob: number;
  bytes: number[];
  top_logprobs?: {
    token: string;
    logprob: number;
    bytes: number[];
  }[];
}

/**
 * chat completion 响应
 */
export interface ChatCompletionResponse extends CResponse {
  choices: ChatChoice[];
  provider?: string;
  citations?: string[];
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  error: {
    message: string;
    type: string | null;
    param: string | null;
    code: string | null;
  };
  provider: string;
}

/**
 * 图像生成响应
 */
export interface ImageGenerateResponse {
  created: number;
  data: object[];
  provider: string;
}

export interface StreamContentBlock {
  index: number;
  delta: {
    text?: string;
    thinking?: string;
    signature?: string;
    data?: string;
  };
}

// ===== Finish Reason 映射 =====

export enum FINISH_REASON {
  stop = 'stop',
  length = 'length',
  tool_calls = 'tool_calls',
  content_filter = 'content_filter',
  function_call = 'function_call',
}

// Chainr 没有独立的 google 目录，将 Google 的 finish reason 内联在此
export enum GOOGLE_GENERATE_CONTENT_FINISH_REASON {
  FINISH_REASON_UNSPECIFIED = 'FINISH_REASON_UNSPECIFIED',
  STOP = 'STOP',
  MAX_TOKENS = 'MAX_TOKENS',
  SAFETY = 'SAFETY',
  RECITATION = 'RECITATION',
  LANGUAGE = 'LANGUAGE',
  OTHER = 'OTHER',
  BLOCKLIST = 'BLOCKLIST',
  PROHIBITED_CONTENT = 'PROHIBITED_CONTENT',
  SPII = 'SPII',
  MALFORMED_FUNCTION_CALL = 'MALFORMED_FUNCTION_CALL',
  IMAGE_SAFETY = 'IMAGE_SAFETY',
}

export type PROVIDER_FINISH_REASON =
  | ANTHROPIC_STOP_REASON
  | BEDROCK_CONVERSE_STOP_REASON
  | VERTEX_GEMINI_GENERATE_CONTENT_FINISH_REASON
  | GOOGLE_GENERATE_CONTENT_FINISH_REASON
  | TITAN_STOP_REASON
  | DEEPSEEK_STOP_REASON
  | MISTRAL_AI_FINISH_REASON
  | TOGETHER_AI_FINISH_REASON
  | COHERE_STOP_REASON;
