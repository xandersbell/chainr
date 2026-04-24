import { ProviderConfigs } from '../types';
import VertexApiConfig, { GoogleApiConfig } from './api';
import {
  GoogleChatCompleteResponseTransform,
  GoogleChatCompleteStreamChunkTransform,
  VertexAnthropicChatCompleteConfig,
  VertexAnthropicChatCompleteResponseTransform,
  VertexAnthropicChatCompleteStreamChunkTransform,
  VertexGoogleChatCompleteConfig,
  VertexLlamaChatCompleteConfig,
  VertexLlamaChatCompleteResponseTransform,
  VertexLlamaChatCompleteStreamChunkTransform,
} from './chatComplete';
import { GoogleEmbedConfig, GoogleEmbedResponseTransform } from './embed';
import { getModelAndProvider } from './utils';
import { chatCompleteParams, responseTransformers } from '../open-ai-base';
import { GOOGLE_VERTEX_AI } from '../../globals';
import { Params } from '../../types/requestBody';
import {
  VertexAnthropicMessagesConfig,
  VertexAnthropicMessagesResponseTransform,
} from './messages';
import { VertexAnthropicMessagesCountTokensConfig } from './messagesCountTokens';
import {
  GetMistralAIChatCompleteResponseTransform,
  GetMistralAIChatCompleteStreamChunkTransform,
  MistralAIChatCompleteConfig,
} from '../mistral-ai/chatComplete';

const VertexConfig: ProviderConfigs = {
  api: VertexApiConfig,
  getConfig: ({ params }) => {
    const providerModel = params?.model;

    if (!providerModel) {
      return {};
    }

    const { provider } = getModelAndProvider(providerModel as string);
    switch (provider) {
      case 'google':
        return {
          chatComplete: VertexGoogleChatCompleteConfig,
          api: GoogleApiConfig,
          embed: GoogleEmbedConfig,
          responseTransforms: {
            'stream-chatComplete': GoogleChatCompleteStreamChunkTransform,
            chatComplete: GoogleChatCompleteResponseTransform,
            embed: GoogleEmbedResponseTransform,
          },
        };
      case 'anthropic':
        return {
          chatComplete: VertexAnthropicChatCompleteConfig,
          api: GoogleApiConfig,
          messages: VertexAnthropicMessagesConfig,
          messagesCountTokens: VertexAnthropicMessagesCountTokensConfig,
          responseTransforms: {
            'stream-chatComplete':
              VertexAnthropicChatCompleteStreamChunkTransform,
            chatComplete: VertexAnthropicChatCompleteResponseTransform,
            messages: VertexAnthropicMessagesResponseTransform,
          },
        };
      case 'meta':
        return {
          chatComplete: VertexLlamaChatCompleteConfig,
          api: GoogleApiConfig,
          responseTransforms: {
            chatComplete: VertexLlamaChatCompleteResponseTransform,
            'stream-chatComplete': VertexLlamaChatCompleteStreamChunkTransform,
          },
        };
      case 'endpoints':
        return {
          chatComplete: chatCompleteParams(
            ['model'],
            {},
            {
              model: {
                param: 'model',
                transform: (params: Params) => {
                  const _model = params.model;
                  return _model?.replace('endpoints.', '');
                },
              },
            }
          ),
          api: GoogleApiConfig,
          responseTransforms: {
            ...responseTransformers(GOOGLE_VERTEX_AI, {
              chatComplete: true,
            }),
          },
        };
      case 'mistralai':
        return {
          chatComplete: MistralAIChatCompleteConfig,
          api: GoogleApiConfig,
          responseTransforms: {
            chatComplete:
              GetMistralAIChatCompleteResponseTransform(GOOGLE_VERTEX_AI),
            'stream-chatComplete':
              GetMistralAIChatCompleteStreamChunkTransform(GOOGLE_VERTEX_AI),
          },
        };
      default:
        return {};
    }
  },
};

export default VertexConfig;
