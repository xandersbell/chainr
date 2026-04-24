import type { Params, EmbedParams, ImageGenerateParams, TranscriptionParams, SpeechParams } from '../types/requestBody';
import type { ChainrConfig, StrategyResult, EmbedResponse, ImageGenerateResponse, TranscriptionResponse, SpeechResponse } from './types';
import type { ChatCompletionChunk } from './types/streaming';
import { FallbackStrategy, LoadBalanceStrategy, SingleStrategy } from './strategies';
import { transformResponse } from './transformResponse';
import { transformAudioRequest, transformSpeechRequest } from './transformRequest';

type ChatCompletionResponse = import('./types').ChatCompletionResponse;
type ErrorResponse = import('./types').ErrorResponse;

export class Chainr {
  private config: ChainrConfig;
  private strategy: FallbackStrategy | LoadBalanceStrategy | SingleStrategy;

  constructor(config: ChainrConfig) {
    this.config = config;
    this.strategy = this.createStrategy(config.strategy);
  }

  private createStrategy(mode: string): FallbackStrategy | LoadBalanceStrategy | SingleStrategy {
    switch (mode) {
      case 'fallback':
        return new FallbackStrategy();
      case 'loadbalance':
        return new LoadBalanceStrategy();
      case 'single':
        return new SingleStrategy();
      default:
        throw new Error(`Unknown strategy mode: ${mode}`);
    }
  }

  chat = {
    completions: {
      create: (
        params: Params
      ): Promise<ChatCompletionResponse | ErrorResponse | ReadableStream<ChatCompletionChunk>> => {
        if (params.stream === true) {
          return this.executeChatCompletionsStreaming(params);
        }
        return this.executeChatCompletions(params);
      },
    },
  };

  embeddings = {
    create: async (params: EmbedParams): Promise<EmbedResponse> => {
      const targets = this.config.embedTargets || this.config.targets;
      const result = await this.strategy.execute(targets, params as unknown as Params, this.config.retry);
      const transformed = transformResponse(
        result.response as unknown as Record<string, unknown>,
        result.provider || 'openai'
      );
      return transformed as unknown as EmbedResponse;
    },
  };

  images = {
    generate: async (params: ImageGenerateParams): Promise<ImageGenerateResponse> => {
      const targets = this.config.imageTargets || this.config.targets;
      const result = await this.strategy.execute(targets, params as unknown as Params, this.config.retry);
      const transformed = transformResponse(
        result.response as unknown as Record<string, unknown>,
        result.provider || 'openai'
      );
      return transformed as unknown as ImageGenerateResponse;
    },
  };

  audio = {
    transcribe: async (params: TranscriptionParams): Promise<TranscriptionResponse> => {
      const targets = this.config.audioTargets || this.config.targets;
      const result = await this.executeAudioTranscription(targets, params);
      return result as unknown as TranscriptionResponse;
    },
  };

  speech = {
    create: async (params: SpeechParams): Promise<SpeechResponse> => {
      const targets = this.config.speechTargets || this.config.targets;
      const result = await this.executeSpeechSynthesis(targets, params);
      return result;
    },
  };

  private async executeChatCompletions(params: Params): Promise<ChatCompletionResponse | ErrorResponse> {
    const result: StrategyResult = await this.strategy.execute(this.config.targets, params, this.config.retry);
    const transformed = transformResponse(
      result.response as unknown as Record<string, unknown>,
      result.provider || 'openai'
    );
    return transformed;
  }

  private async executeChatCompletionsStreaming(params: Params): Promise<ReadableStream<ChatCompletionChunk>> {
    return this.strategy.executeStream(this.config.targets, params, this.config.retry);
  }

  private async executeAudioTranscription(
    targets: Array<Record<string, unknown>>,
    params: TranscriptionParams
  ): Promise<TranscriptionResponse> {
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const provider = (target['provider'] as string) || 'openai';
        const { body, headers, url, isFormData } = transformAudioRequest(params, provider, target);

        const options: RequestInit = {
          method: 'POST',
          headers,
        };

        if (isFormData && body instanceof FormData) {
          options.body = body;
        } else {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data as TranscriptionResponse;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(lastError || 'All audio transcription targets exhausted');
  }

  private async executeSpeechSynthesis(
    targets: Array<Record<string, unknown>>,
    params: SpeechParams
  ): Promise<SpeechResponse> {
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const provider = (target['provider'] as string) || 'openai';
        const { body, headers, url } = transformSpeechRequest(params, provider, target);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'audio/mpeg';

        return {
          audio_data: arrayBuffer,
          contentType,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(lastError || 'All speech synthesis targets exhausted');
  }
}