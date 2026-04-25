// Adapted from Portkey's src/providers/types.ts
// Removed Hono Context dependency and Batch/Finetune/File related types

import type { Message, Options, Params } from '../types/requestBody';
import type { ANTHROPIC_STOP_REASON } from './anthropic/types';
import type {
  BEDROCK_CONVERSE_STOP_REASON,
  TITAN_STOP_REASON,
} from './bedrock/types';
import type { VERTEX_GEMINI_GENERATE_CONTENT_FINISH_REASON } from './google-vertex-ai/types';
import type { DEEPSEEK_STOP_REASON } from './deepseek/types';
import type { MISTRAL_AI_FINISH_REASON } from './mistral-ai/types';
import type { TOGETHER_AI_FINISH_REASON } from './together-ai/types';
import type { COHERE_STOP_REASON } from './cohere/types';
import type { LATITUDE_STOP_REASON } from './latitude/types';

/**
 * Parameter configuration interface
 */
export interface ParameterConfig {
  /** Parameter key name after provider transformation */
  param: string;
  /** Default value */
  default?: any;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Whether the parameter is required */
  required?: boolean;
  /** Parameter value transform function */
  transform?: (params: any, providerOptions: Options) => any;
}

/**
 * Parameter mapping config for a single provider
 */
export interface ProviderConfig {
  [key: string]: ParameterConfig | ParameterConfig[];
}

/**
 * Provider API configuration interface
 * Note: All `c: Context` (Hono) parameters have been removed compared to Portkey
 */
export interface ProviderAPIConfig {
  /** Generate request headers */
  headers: (args: {
    providerOptions: Options;
    fn: string;
    transformedRequestBody: Record<string, any>;
    transformedRequestUrl: string;
    gatewayRequestBody?: Params;
    headers?: Record<string, string>;
  }) => Promise<Record<string, any>> | Record<string, any>;

  /** Generate baseURL */
  getBaseURL: (args: {
    providerOptions: Options;
    fn?: endpointStrings;
    requestHeaders?: Record<string, string>;
    gatewayRequestURL: string;
    params?: Params;
  }) => Promise<string> | string;

  /** Generate endpoint path */
  getEndpoint: (args: {
    providerOptions: Options;
    fn: endpointStrings;
    gatewayRequestBodyJSON: Params;
    gatewayRequestBody?: FormData | Params | ArrayBuffer | ReadableStream;
    gatewayRequestURL: string;
  }) => string;

  /** Whether to transform request body to FormData */
  transformToFormData?: (args: { gatewayRequestBody: Params }) => boolean;

  getProxyEndpoint?: (args: {
    providerOptions: Options;
    reqPath: string;
    reqQuery: string;
  }) => string;
}

// Priorai only retains inference-related endpoint types
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
 * Collection of Provider API configurations
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
 * Complete provider config export (each provider's index.ts exports this type)
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
 * Base completion response
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
 * Completions response
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
 * Choice within a chat completion response
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
 * Chat completion response
 */
export interface ChatCompletionResponse extends CResponse {
  choices: ChatChoice[];
  provider?: string;
  citations?: string[];
}

/**
 * Error response
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
 * Image generation response
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

// ===== Finish Reason mappings =====

export enum FINISH_REASON {
  stop = 'stop',
  length = 'length',
  tool_calls = 'tool_calls',
  content_filter = 'content_filter',
  function_call = 'function_call',
}

// Priorai has no standalone google directory, so Google's finish reason is inlined here
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
  | COHERE_STOP_REASON
  | LATITUDE_STOP_REASON;

/**
 * Finetune request parameter interface (adapted from Portkey)
 */
export interface FinetuneRequest {
  model: string;
  suffix: string;
  training_file: string;
  validation_file?: string;
  model_type?: string;
  hyperparameters?: {
    n_epochs?: number;
    learning_rate_multiplier?: number;
    batch_size?: number;
  };
  method?: {
    type: 'supervised' | 'dpo';
    supervised?: {
      hyperparameters: {
        n_epochs?: number;
        learning_rate_multiplier?: number;
        batch_size?: number;
      };
    };
    dpo?: {
      hyperparameters: {
        beta?: string | number;
        n_epochs?: number;
        learning_rate_multiplier?: number;
        batch_size?: number;
      };
    };
  };
  [key: string]: any;
}
