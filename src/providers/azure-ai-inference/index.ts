import type { ProviderConfigs } from '../types';
import {
  AzureAIInferenceCompleteConfig,
  AzureAIInferenceCompleteResponseTransform,
} from './complete';
import {
  AzureAIInferenceEmbedConfig,
  AzureAIInferenceEmbedResponseTransform,
} from './embed';
import AzureAIInferenceAPI from './api';
import {
  AzureAIInferenceChatCompleteConfig,
  AzureAIInferenceChatCompleteResponseTransform,
} from './chatComplete';
import { AZURE_AI_INFERENCE, GITHUB } from '../../globals';
import {
  AzureAIInferenceCreateSpeechResponseTransform,
  AzureAIInferenceCreateTranscriptionResponseTransform,
  AzureAIInferenceCreateTranslationResponseTransform,
  AzureAIInferenceResponseTransform,
} from './utils';
import {
  AnthropicChatCompleteConfig,
  getAnthropicChatCompleteResponseTransform,
  getAnthropicStreamChunkTransform,
} from '../anthropic/chatComplete';
import {
  AzureAIInferenceMessagesConfig,
  AzureAIInferenceMessagesResponseTransform,
} from './messages';

const AzureAIInferenceAPIConfig: ProviderConfigs = {
  api: AzureAIInferenceAPI,
  getConfig: ({ providerOptions }) => {
    const { azureFoundryUrl } = providerOptions || {};
    const isAnthropicModel = azureFoundryUrl?.includes('anthropic');
    const chatCompleteConfig = isAnthropicModel
      ? AnthropicChatCompleteConfig
      : AzureAIInferenceChatCompleteConfig;
    const chatCompleteResponseTransform = isAnthropicModel
      ? getAnthropicChatCompleteResponseTransform(AZURE_AI_INFERENCE)
      : AzureAIInferenceChatCompleteResponseTransform(AZURE_AI_INFERENCE);
    return {
      complete: AzureAIInferenceCompleteConfig,
      embed: AzureAIInferenceEmbedConfig,
      chatComplete: chatCompleteConfig,
      messages: AzureAIInferenceMessagesConfig,
      imageEdit: {},
      createTranscription: {},
      createTranslation: {},
      realtime: {},
      cancelBatch: {},
      cancelFinetune: {},
      responseTransforms: {
        complete: AzureAIInferenceCompleteResponseTransform(AZURE_AI_INFERENCE),
        ...(isAnthropicModel && {
          'stream-chatComplete':
            getAnthropicStreamChunkTransform(AZURE_AI_INFERENCE),
        }),
        chatComplete: chatCompleteResponseTransform,
        messages: AzureAIInferenceMessagesResponseTransform,
        embed: AzureAIInferenceEmbedResponseTransform(AZURE_AI_INFERENCE),
        imageGenerate: AzureAIInferenceResponseTransform,
        createSpeech: AzureAIInferenceCreateSpeechResponseTransform,
        createTranscription:
          AzureAIInferenceCreateTranscriptionResponseTransform,
        createTranslation: AzureAIInferenceCreateTranslationResponseTransform,
        realtime: {},
        createBatch: AzureAIInferenceResponseTransform,
        retrieveBatch: AzureAIInferenceResponseTransform,
        cancelBatch: AzureAIInferenceResponseTransform,
        listBatches: AzureAIInferenceResponseTransform,
        uploadFile: AzureAIInferenceResponseTransform,
        listFiles: AzureAIInferenceResponseTransform,
        retrieveFile: AzureAIInferenceResponseTransform,
        deleteFile: AzureAIInferenceResponseTransform,
        retrieveFileContent: AzureAIInferenceResponseTransform,
      },
    };
  },
};

const GithubModelAPiConfig: ProviderConfigs = {
  complete: AzureAIInferenceCompleteConfig,
  embed: AzureAIInferenceEmbedConfig,
  api: AzureAIInferenceAPI,
  chatComplete: AzureAIInferenceChatCompleteConfig,
  responseTransforms: {
    complete: AzureAIInferenceCompleteResponseTransform(GITHUB),
    chatComplete: AzureAIInferenceChatCompleteResponseTransform(GITHUB),
    embed: AzureAIInferenceEmbedResponseTransform(GITHUB),
  },
};

export { AzureAIInferenceAPIConfig, GithubModelAPiConfig };
