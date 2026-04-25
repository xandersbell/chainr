import { AZURE_OPEN_AI } from '../../globals';
import {
  createModelResponseParams,
  OpenAICreateModelResponseTransformer,
  OpenAIDeleteModelResponseTransformer,
  OpenAIGetModelResponseTransformer,
  OpenAIListInputItemsResponseTransformer,
} from '../open-ai-base';
import type { ProviderConfigs } from '../types';
import AzureOpenAIAPIConfig from './api';
import { AzureOpenAIChatCompleteConfig, AzureOpenAIResponseTransform } from './chatComplete';
import { AzureOpenAICompleteConfig, AzureOpenAICompleteResponseTransform } from './complete';
import { AzureOpenAIEmbedConfig, AzureOpenAIEmbedResponseTransform } from './embed';
import { AzureOpenAIFinetuneResponseTransform, getAzureModelValue } from './utils';

const AzureOpenAIConfig: ProviderConfigs = {
  complete: AzureOpenAICompleteConfig,
  embed: AzureOpenAIEmbedConfig,
  api: AzureOpenAIAPIConfig,
  imageEdit: {},
  chatComplete: AzureOpenAIChatCompleteConfig,
  createTranscription: {},
  createTranslation: {},
  realtime: {},
  cancelFinetune: {},
  cancelBatch: {},
  createModelResponse: createModelResponseParams(
    [],
    {},
    {
      model: {
        param: 'model',
        transform: getAzureModelValue,
      },
    },
  ),
  getModelResponse: {},
  deleteModelResponse: {},
  listModelsResponse: {},
  responseTransforms: {
    complete: AzureOpenAICompleteResponseTransform,
    chatComplete: AzureOpenAIResponseTransform,
    embed: AzureOpenAIEmbedResponseTransform,
    realtime: {},
    retrieveFinetune: AzureOpenAIFinetuneResponseTransform,
    createModelResponse: OpenAICreateModelResponseTransformer(AZURE_OPEN_AI),
    getModelResponse: OpenAIGetModelResponseTransformer(AZURE_OPEN_AI),
    deleteModelResponse: OpenAIDeleteModelResponseTransformer(AZURE_OPEN_AI),
    listModelsResponse: OpenAIListInputItemsResponseTransformer(AZURE_OPEN_AI),
  },
};

export default AzureOpenAIConfig;
