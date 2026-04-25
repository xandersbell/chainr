import { AI21, ANTHROPIC, COHERE } from '../../globals';
import type { ProviderConfigs } from '../types';
import BedrockAPIConfig from './api';
import {
  BedrockAI21ChatCompleteConfig,
  BedrockAI21ChatCompleteResponseTransform,
  BedrockChatCompleteResponseTransform,
  BedrockChatCompleteStreamChunkTransform,
  BedrockCohereChatCompleteConfig,
  BedrockCohereChatCompleteResponseTransform,
  BedrockCohereChatCompleteStreamChunkTransform,
  BedrockConverseAI21ChatCompleteConfig,
  BedrockConverseAnthropicChatCompleteConfig,
  BedrockConverseChatCompleteConfig,
  BedrockConverseCohereChatCompleteConfig,
} from './chatComplete';
import {
  BedrockAI21CompleteConfig,
  BedrockAI21CompleteResponseTransform,
  BedrockAnthropicCompleteConfig,
  BedrockAnthropicCompleteResponseTransform,
  BedrockAnthropicCompleteStreamChunkTransform,
  BedrockCohereCompleteConfig,
  BedrockCohereCompleteResponseTransform,
  BedrockCohereCompleteStreamChunkTransform,
  BedrockLLamaCompleteConfig,
  BedrockLlamaCompleteResponseTransform,
  BedrockLlamaCompleteStreamChunkTransform,
  BedrockMistralCompleteConfig,
  BedrockMistralCompleteResponseTransform,
  BedrockMistralCompleteStreamChunkTransform,
  BedrockTitanCompleteConfig,
  BedrockTitanCompleteResponseTransform,
  BedrockTitanCompleteStreamChunkTransform,
} from './complete';
import {
  BedrockAnthropicMessageCountTokensConfig,
  BedrockConverseMessageCountTokensConfig,
  BedrockConverseMessageCountTokensResponseTransform,
} from './countTokens';
import {
  BedrockCohereEmbedConfig,
  BedrockCohereEmbedResponseTransform,
  BedrockTitanEmbedConfig,
  BedrockTitanEmbedResponseTransform,
} from './embed';
import {
  AnthropicBedrockConverseMessagesConfig as BedrockAnthropicConverseMessagesConfig,
  BedrockConverseMessagesConfig,
  BedrockConverseMessagesStreamChunkTransform,
  BedrockMessagesResponseTransform,
} from './messages';
import { getBedrockModelWithoutRegion } from './utils';

const BedrockConfig: ProviderConfigs = {
  api: BedrockAPIConfig,
  getConfig: ({ params, providerOptions }) => {
    // Remove region prefix from cross-region inference profile ID
    // https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference-support.html
    let config: ProviderConfigs = {};

    if (params.model) {
      let providerModel = providerOptions.foundationModel || params.model;
      providerModel = getBedrockModelWithoutRegion(providerModel);
      const providerModelArray = providerModel?.split('.');
      const provider = providerModelArray?.[0];
      const model = providerModelArray?.slice(1).join('.');
      switch (provider) {
        case ANTHROPIC:
          config = {
            complete: BedrockAnthropicCompleteConfig,
            chatComplete: BedrockConverseAnthropicChatCompleteConfig,
            messages: BedrockAnthropicConverseMessagesConfig,
            messagesCountTokens: BedrockAnthropicMessageCountTokensConfig,
            api: BedrockAPIConfig,
            responseTransforms: {
              'stream-complete': BedrockAnthropicCompleteStreamChunkTransform,
              complete: BedrockAnthropicCompleteResponseTransform,
            },
          };
          break;
        case COHERE:
          config = {
            complete: BedrockCohereCompleteConfig,
            chatComplete: BedrockConverseCohereChatCompleteConfig,
            embed: BedrockCohereEmbedConfig,
            api: BedrockAPIConfig,
            responseTransforms: {
              'stream-complete': BedrockCohereCompleteStreamChunkTransform,
              complete: BedrockCohereCompleteResponseTransform,
              embed: BedrockCohereEmbedResponseTransform,
            },
          };
          if (['command-text-v14', 'command-light-text-v14'].includes(model)) {
            config.chatComplete = BedrockCohereChatCompleteConfig;
            config.responseTransforms['stream-chatComplete'] =
              BedrockCohereChatCompleteStreamChunkTransform;
            config.responseTransforms.chatComplete = BedrockCohereChatCompleteResponseTransform;
          }
          break;
        case 'meta':
          config = {
            complete: BedrockLLamaCompleteConfig,
            api: BedrockAPIConfig,
            responseTransforms: {
              'stream-complete': BedrockLlamaCompleteStreamChunkTransform,
              complete: BedrockLlamaCompleteResponseTransform,
            },
          };
          break;
        case 'mistral':
          config = {
            complete: BedrockMistralCompleteConfig,
            api: BedrockAPIConfig,
            responseTransforms: {
              'stream-complete': BedrockMistralCompleteStreamChunkTransform,
              complete: BedrockMistralCompleteResponseTransform,
            },
          };
          break;
        case 'amazon':
          config = {
            complete: BedrockTitanCompleteConfig,
            embed: BedrockTitanEmbedConfig,
            api: BedrockAPIConfig,
            responseTransforms: {
              'stream-complete': BedrockTitanCompleteStreamChunkTransform,
              complete: BedrockTitanCompleteResponseTransform,
              embed: BedrockTitanEmbedResponseTransform,
            },
          };
          break;
        case AI21:
          config = {
            complete: BedrockAI21CompleteConfig,
            api: BedrockAPIConfig,
            chatComplete: BedrockConverseAI21ChatCompleteConfig,
            responseTransforms: {
              complete: BedrockAI21CompleteResponseTransform,
            },
          };
          if (['j2-mid-v1', 'j2-ultra-v1'].includes(model)) {
            config.chatComplete = BedrockAI21ChatCompleteConfig;
            config.responseTransforms.chatComplete = BedrockAI21ChatCompleteResponseTransform;
          }
          break;
        case 'stability':
          // stability models not supported (imageGenerate file removed)
          return {
            api: BedrockAPIConfig,
          };
      }

      // Merge default configuration
      config = {
        ...config,
        ...(!config.chatComplete && {
          chatComplete: BedrockConverseChatCompleteConfig,
        }),
        ...(!config.messages && {
          messages: BedrockConverseMessagesConfig,
        }),
        ...(!config.messagesCountTokens && {
          messagesCountTokens: BedrockConverseMessageCountTokensConfig,
        }),
      };

      config.responseTransforms = {
        ...(config.responseTransforms ?? {}),
        ...(!config.responseTransforms?.chatComplete && {
          chatComplete: BedrockChatCompleteResponseTransform,
        }),
        ...(!config.responseTransforms?.['stream-chatComplete'] && {
          'stream-chatComplete': BedrockChatCompleteStreamChunkTransform,
        }),
        ...(!config.responseTransforms?.messages && {
          messages: BedrockMessagesResponseTransform,
        }),
        ...(!config.responseTransforms?.['stream-messages'] && {
          'stream-messages': BedrockConverseMessagesStreamChunkTransform,
        }),
        ...(!config.responseTransforms?.messagesCountTokens && {
          messagesCountTokens: BedrockConverseMessageCountTokensResponseTransform,
        }),
      };
    }

    config.cancelBatch = {};
    config.cancelFinetune = {};
    return config;
  },
};

export default BedrockConfig;
