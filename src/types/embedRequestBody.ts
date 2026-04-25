// Adapted from Portkey's src/types/embedRequestBody.ts

import type { BaseResponse } from '../providers/types';
import type { Options } from './requestBody';

type EmbedInput = {
  text?: string;
  image?: {
    url?: string;
    base64?: string;
    text?: string;
  };
  video?: {
    url?: string;
    base64?: string;
    start_offset?: number;
    end_offset?: number;
    interval?: number;
    text?: string;
  };
};

export interface EmbedParams {
  model: string;
  input: string | string[] | EmbedInput[];
  user: string;
  dimensions?: number;
}

export interface EmbedRequestBody {
  config: {
    provider?: string;
    apiKeyName?: string;
    apiKey?: string;
    mode?: string;
    options?: Options[];
  };
  params: EmbedParams;
}

export interface EmbedResponseData {
  object: string;
  embedding?: number[] | number[][];
  image_embedding?: number[];
  video_embeddings?: {
    start_offset: number;
    end_offset?: number;
    embedding: number[];
  }[];
  index: number;
}

export interface EmbedResponse extends BaseResponse {
  object: string;
  data: EmbedResponseData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}
