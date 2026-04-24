import { ProviderConfigs } from '../types';
import {
  AzureOpenAICompleteConfig,
  AzureOpenAICompleteResponseTransform,
} from './complete';
import {
  AzureOpenAIEmbedConfig,
  AzureOpenAIEmbedResponseTransform,
} from './embed';
import AzureOpenAIAPIConfig from './api';
import {
  AzureOpenAIChatCompleteConfig,
  AzureOpenAIResponseTransform,
} from './chatComplete';
import {
  AzureOpenAIFinetuneResponseTransform,
  getAzureModelValue,
} from './utils';
import {
  createModelResponseParams,
  OpenAICreateModelResponseTransformer,
  OpenAIDeleteModelResponseTransformer,
  OpenAIGetModelResponseTransformer,
  OpenAIListInputItemsResponseTransformer,
} from '../open-ai-base';
import { AZURE_OPEN_AI } from '../../globals';

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
    }
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
