import type { Params, EmbedParams, ImageGenerateParams, TranscriptionParams, SpeechParams, TranslationParams } from '../types/requestBody';
import type { ChainrConfig, StrategyResult, EmbedResponse, ImageGenerateResponse, TranscriptionResponse, SpeechResponse } from './types';
import type { ChatCompletionChunk } from './types/streaming';
import { FallbackStrategy, LoadBalanceStrategy, SingleStrategy } from './strategies';
import { buildProviderRequest, transformProviderResponse } from './providerRequest';
import { fetchWithTimeout } from './RetryHandler';

type ChatCompletionResponse = import('./types').ChatCompletionResponse;
type ErrorResponse = import('./types').ErrorResponse;

export class Chainr {
  private config: ChainrConfig;
  private strategy: FallbackStrategy | LoadBalanceStrategy | SingleStrategy;

  constructor(config: ChainrConfig) {
    this.validateConfig(config);
    this.config = config;
    this.strategy = this.createStrategy(config.strategy);
  }

  private validateConfig(config: ChainrConfig): void {
    if (!config.targets || config.targets.length === 0) {
      throw new Error('At least one target is required');
    }
    for (const target of config.targets) {
      if (!target['provider']) {
        throw new Error('Each target must have a "provider" field');
      }
    }
    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      throw new Error('timeout must be a positive number (milliseconds)');
    }
    if (config.retry) {
      if (typeof config.retry.attempts !== 'number' || config.retry.attempts < 1) {
        throw new Error('retry.attempts must be a positive integer');
      }
    }
    for (const key of ['embedTargets', 'imageTargets', 'audioTargets', 'speechTargets'] as const) {
      const targets = config[key];
      if (targets) {
        for (const target of targets) {
          if (!target['provider']) {
            throw new Error(`Each target in ${key} must have a "provider" field`);
          }
        }
      }
    }
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
      return this.executeEmbeddings(targets, params);
    },
  };

  images = {
    generate: async (params: ImageGenerateParams): Promise<ImageGenerateResponse> => {
      const targets = this.config.imageTargets || this.config.targets;
      return this.executeImageGeneration(targets, params);
    },
  };

  audio = {
    transcribe: async (params: TranscriptionParams): Promise<TranscriptionResponse> => {
      const targets = this.config.audioTargets || this.config.targets;
      const result = await this.executeAudioTranscription(targets, params);
      return result as unknown as TranscriptionResponse;
    },
    translate: async (params: TranslationParams): Promise<TranscriptionResponse> => {
      const targets = this.config.audioTargets || this.config.targets;
      const result = await this.executeAudioTranslation(targets, params);
      return result;
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
    const result: StrategyResult = await this.strategy.execute(this.config.targets, params, this.config.retry, this.config.timeout);
    const transformed = transformProviderResponse(
      result.response,
      result.provider || 'openai',
      'chatComplete'
    );
    return transformed as ChatCompletionResponse | ErrorResponse;
  }

  private async executeChatCompletionsStreaming(params: Params): Promise<ReadableStream<ChatCompletionChunk>> {
    return this.strategy.executeStream(this.config.targets, params, this.config.retry, this.config.timeout);
  }

  private async executeEmbeddings(
    targets: Array<Record<string, unknown>>,
    params: EmbedParams
  ): Promise<EmbedResponse> {
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const provider = (target['provider'] as string) || 'openai';
        const { body, headers, url } = await buildProviderRequest(params as unknown as Params, provider, target, 'embed');

        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }, this.config.timeout ?? 30000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const transformed = transformProviderResponse(data, provider, 'embed');
        return transformed as unknown as EmbedResponse;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(lastError || 'All embedding targets exhausted');
  }

  private async executeImageGeneration(
    targets: Array<Record<string, unknown>>,
    params: ImageGenerateParams
  ): Promise<ImageGenerateResponse> {
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const provider = (target['provider'] as string) || 'openai';
        const { body, headers, url } = await buildProviderRequest(params as unknown as Params, provider, target, 'imageGenerate');

        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }, this.config.timeout ?? 30000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const transformed = transformProviderResponse(data, provider, 'imageGenerate');
        return transformed as unknown as ImageGenerateResponse;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(lastError || 'All image generation targets exhausted');
  }

  private async executeAudioTranscription(
    targets: Array<Record<string, unknown>>,
    params: TranscriptionParams
  ): Promise<TranscriptionResponse> {
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const provider = (target['provider'] as string) || 'openai';
        const { body, headers, url } = await buildProviderRequest(params as unknown as Params, provider, target, 'createTranscription');

        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }, this.config.timeout ?? 30000);

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
        const { body, headers, url } = await buildProviderRequest(params as unknown as Params, provider, target, 'createSpeech');

        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }, this.config.timeout ?? 30000);

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

  private async executeAudioTranslation(
    targets: Array<Record<string, unknown>>,
    params: TranslationParams
  ): Promise<TranscriptionResponse> {
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const provider = (target['provider'] as string) || 'openai';
        const { body, headers, url } = await buildProviderRequest(params as unknown as Params, provider, target, 'createTranslation');

        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }, this.config.timeout ?? 30000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data as TranscriptionResponse;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(lastError || 'All audio translation targets exhausted');
  }
}
