import type { Params, EmbedParams, ImageGenerateParams, TranscriptionParams, SpeechParams, TranslationParams } from '../types/requestBody';
import type { ChainrConfig, TargetConfig, StrategyResult, EmbedResponse, ImageGenerateResponse, TranscriptionResponse, SpeechResponse } from './types';
import type { ChatCompletionChunk } from './types/streaming';
import type { MessagesResponse } from '../types/messagesResponse';
import { FallbackStrategy, LoadBalanceStrategy, SingleStrategy, ConditionalStrategy } from './strategies';
import type { ConditionConfig } from './strategies';
import { buildProviderRequest, transformProviderResponse } from './providerRequest';
import { fetchWithTimeout } from './RetryHandler';

type ChatCompletionResponse = import('./types').ChatCompletionResponse;
type ErrorResponse = import('./types').ErrorResponse;

export class Chainr {
  private config: ChainrConfig;
  private strategy: FallbackStrategy | LoadBalanceStrategy | SingleStrategy | ConditionalStrategy;

  constructor(config: ChainrConfig) {
    this.validateConfig(config);
    this.config = config;
    this.strategy = this.createStrategy(config.strategy);
  }

  private validateConfig(config: ChainrConfig): void {
    if (!config.targets || config.targets.length === 0) {
      throw new Error('At least one target is required');
    }
    // 递归验证所有 target（conditional 策略下 target 可以没有 provider，只需有 name）
    if (config.strategy !== 'conditional') {
      this.validateTargets(config.targets, 'targets');
    }
    // conditional 策略需要 conditions 配置
    if (config.strategy === 'conditional') {
      if (!config.conditions || config.conditions.length === 0) {
        throw new Error('conditional strategy requires non-empty "conditions" array');
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
    for (const key of ['embedTargets', 'imageTargets', 'audioTargets', 'speechTargets', 'messagesTargets', 'responsesTargets'] as const) {
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

  /**
   * 递归验证 target 列表
   * 叶节点必须有 provider，嵌套策略组必须有 strategy + 非空 targets
   */
  private validateTargets(targets: TargetConfig[], path: string): void {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const targetPath = `${path}[${i}]`;

      if (target.strategy || target.targets) {
        // 嵌套策略组
        if (!target.strategy) {
          throw new Error(`${targetPath} has "targets" but missing "strategy" field`);
        }
        if (!['fallback', 'loadbalance', 'single'].includes(target.strategy)) {
          throw new Error(`${targetPath} has unknown strategy: ${target.strategy}`);
        }
        if (!Array.isArray(target.targets) || target.targets.length === 0) {
          throw new Error(`${targetPath} strategy "${target.strategy}" requires non-empty "targets" array`);
        }
        // 递归验证子 targets
        this.validateTargets(target.targets, `${targetPath}.targets`);
      } else {
        // 叶节点
        if (!target.provider) {
          throw new Error(`${targetPath} must have a "provider" field`);
        }
      }
    }
  }

  private createStrategy(mode: string): FallbackStrategy | LoadBalanceStrategy | SingleStrategy | ConditionalStrategy {
    switch (mode) {
      case 'fallback':
        return new FallbackStrategy();
      case 'loadbalance':
        return new LoadBalanceStrategy();
      case 'single':
        return new SingleStrategy();
      case 'conditional':
        return new ConditionalStrategy();
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
    edit: async (params: Params): Promise<Record<string, unknown>> => {
      const targets = this.config.imageTargets || this.config.targets;
      return this.executeSimpleEndpoint(targets as TargetConfig[], params, 'imageEdit');
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

  /**
   * Anthropic Messages API — 原生格式透传
   * 请求/响应都是 Anthropic 原生格式，不做 OpenAI 兼容转换
   * 支持 fallback/loadbalance/single 路由策略
   */
  messages = {
    create: (
      params: Params
    ): Promise<MessagesResponse | ErrorResponse | ReadableStream> => {
      if (params.stream === true) {
        return this.executeMessagesStreaming(params);
      }
      return this.executeMessages(params);
    },
  };

  /**
   * OpenAI Responses API — /v1/responses 端点
   * 使用 input/instructions 替代 messages/system，支持 tool calling、reasoning 等
   * 支持 fallback/loadbalance/single 路由策略
   */
  responses = {
    create: (
      params: Params
    ): Promise<Record<string, unknown> | ErrorResponse | ReadableStream> => {
      if (params.stream === true) {
        return this.executeResponsesStreaming(params);
      }
      return this.executeResponses(params);
    },
  };

  /**
   * Legacy text completion API — /v1/completions 端点
   * 通过策略系统路由，支持 fallback/loadbalance/single
   */
  completions = {
    create: (
      params: Params
    ): Promise<Record<string, unknown> | ErrorResponse | ReadableStream> => {
      if (params.stream === true) {
        return this.executeStrategyStream(this.config.targets, params, 'complete') as Promise<ReadableStream>;
      }
      return this.executeCompletions(params);
    },
  };

  /**
   * 文件操作 API — upload/list/delete/retrieve
   * 使用简单循环模式（管理类端点，不需要策略路由）
   */
  files = {
    upload: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'uploadFile');
    },
    list: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'listFiles');
    },
    del: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'deleteFile');
    },
    retrieve: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'retrieveFile');
    },
    content: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'retrieveFileContent');
    },
  };

  /**
   * Batch API — 批量推理
   */
  batches = {
    create: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'createBatch');
    },
    retrieve: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'retrieveBatch');
    },
    list: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'listBatches');
    },
    cancel: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'cancelBatch');
    },
  };

  /**
   * Fine-tune API — 微调管理
   */
  fineTuning = {
    create: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'createFinetune');
    },
    list: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'listFinetunes');
    },
    cancel: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'cancelFinetune');
    },
    retrieve: async (params: Params): Promise<Record<string, unknown>> => {
      return this.executeSimpleEndpoint(this.config.targets, params, 'retrieveFinetune');
    },
  };

  private async executeChatCompletions(params: Params): Promise<ChatCompletionResponse | ErrorResponse> {
    const result: StrategyResult = await this.executeStrategy(this.config.targets, params, 'chatComplete');
    const transformed = transformProviderResponse(
      result.response,
      result.provider || 'openai',
      'chatComplete'
    );
    return transformed as ChatCompletionResponse | ErrorResponse;
  }

  private async executeChatCompletionsStreaming(params: Params): Promise<ReadableStream<ChatCompletionChunk>> {
    return this.executeStrategyStream(this.config.targets, params, 'chatComplete');
  }

  /**
   * Anthropic Messages API — 非流式
   */
  private async executeMessages(params: Params): Promise<MessagesResponse | ErrorResponse> {
    const targets = this.config.messagesTargets || this.config.targets;
    const result: StrategyResult = await this.executeStrategy(targets, params, 'messages');
    const transformed = transformProviderResponse(
      result.response,
      result.provider || 'anthropic',
      'messages'
    );
    return transformed as MessagesResponse | ErrorResponse;
  }

  /**
   * Anthropic Messages API — 流式
   */
  private async executeMessagesStreaming(params: Params): Promise<ReadableStream> {
    const targets = this.config.messagesTargets || this.config.targets;
    return this.executeStrategyStream(targets, params, 'messages');
  }

  /**
   * OpenAI Responses API — 非流式
   */
  private async executeResponses(params: Params): Promise<Record<string, unknown> | ErrorResponse> {
    const targets = this.config.responsesTargets || this.config.targets;
    const result: StrategyResult = await this.executeStrategy(targets, params, 'createModelResponse');
    const transformed = transformProviderResponse(
      result.response,
      result.provider || 'openai',
      'createModelResponse'
    );
    return transformed as Record<string, unknown> | ErrorResponse;
  }

  /**
   * OpenAI Responses API — 流式
   */
  private async executeResponsesStreaming(params: Params): Promise<ReadableStream> {
    const targets = this.config.responsesTargets || this.config.targets;
    return this.executeStrategyStream(targets, params, 'createModelResponse');
  }

  /**
   * 统一策略执行入口 — 处理 conditional 策略的额外参数
   */
  private async executeStrategy(
    targets: TargetConfig[],
    params: Params,
    endpoint: import('../providers/types').endpointStrings
  ): Promise<StrategyResult> {
    if (this.config.strategy === 'conditional') {
      return (this.strategy as ConditionalStrategy).execute(
        targets, params, this.config.retry, this.config.timeout, endpoint,
        this.config.conditions, this.config.conditionalDefault, this.config.metadata
      );
    }
    return this.strategy.execute(targets, params, this.config.retry, this.config.timeout, endpoint);
  }

  /**
   * 统一流式策略执行入口
   */
  private async executeStrategyStream(
    targets: TargetConfig[],
    params: Params,
    endpoint: import('../providers/types').endpointStrings
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    if (this.config.strategy === 'conditional') {
      return (this.strategy as ConditionalStrategy).executeStream(
        targets, params, this.config.retry, this.config.timeout, endpoint,
        this.config.conditions, this.config.conditionalDefault, this.config.metadata
      );
    }
    return this.strategy.executeStream(targets, params, this.config.retry, this.config.timeout, endpoint);
  }

  /**
   * Legacy text completion — 非流式
   * 通过策略系统路由，使用 'complete' endpoint 配置
   */
  private async executeCompletions(params: Params): Promise<Record<string, unknown> | ErrorResponse> {
    const result: StrategyResult = await this.executeStrategy(this.config.targets, params, 'complete');
    const transformed = transformProviderResponse(
      result.response,
      result.provider || 'openai',
      'complete'
    );
    return transformed as Record<string, unknown> | ErrorResponse;
  }

  /**
   * 通用简单端点执行 — 管理类 API（文件、批量、微调、图片编辑等）
   * 使用简单循环模式，逐个 target 尝试直到成功
   */
  private async executeSimpleEndpoint(
    targets: TargetConfig[],
    params: Params,
    endpoint: import('../providers/types').endpointStrings
  ): Promise<Record<string, unknown>> {
    let lastError: string | undefined;

    for (const target of targets) {
      try {
        const provider = (target['provider'] as string) || 'openai';
        const { body, headers, url } = await buildProviderRequest(params, provider, target, endpoint);

        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: body instanceof FormData ? body : JSON.stringify(body),
        }, this.config.timeout ?? 30000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const transformed = transformProviderResponse(data, provider, endpoint);
        return transformed as Record<string, unknown>;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(lastError || `All ${endpoint} targets exhausted`);
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
