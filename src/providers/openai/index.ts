import type { ProviderConfigs } from '../types';
import {
  OpenAICompleteConfig,
  OpenAICompleteResponseTransform,
} from './complete';
import { OpenAIEmbedConfig } from './embed';
import OpenAIAPIConfig from './api';
import {
  OpenAIChatCompleteConfig,
  OpenAIChatCompleteResponseTransform,
} from './chatComplete';
import {
  createModelResponseParams,
  OpenAICreateModelResponseTransformer,
  OpenAIGetModelResponseTransformer,
  OpenAIDeleteModelResponseTransformer,
  OpenAIListInputItemsResponseTransformer,
} from '../open-ai-base';
import { OPEN_AI } from '../../globals';

const OpenAIConfig: ProviderConfigs = {
  complete: OpenAICompleteConfig,
  embed: OpenAIEmbedConfig,
  api: OpenAIAPIConfig,
  chatComplete: OpenAIChatCompleteConfig,
  imageEdit: {},
  createTranscription: {},
  createTranslation: {},
  realtime: {},
  cancelBatch: {},
  cancelFinetune: {},
  createModelResponse: createModelResponseParams([]),
  getModelResponse: {},
  deleteModelResponse: {},
  listModelsResponse: {},
  responseTransforms: {
    complete: OpenAICompleteResponseTransform,
    // 'stream-complete': OpenAICompleteResponseTransform,
    chatComplete: OpenAIChatCompleteResponseTransform,
    // 'stream-chatComplete': OpenAIChatCompleteResponseTransform,
    realtime: {},
    createModelResponse: OpenAICreateModelResponseTransformer(OPEN_AI),
    getModelResponse: OpenAIGetModelResponseTransformer(OPEN_AI),
    deleteModelResponse: OpenAIDeleteModelResponseTransformer(OPEN_AI),
    listModelsResponse: OpenAIListInputItemsResponseTransformer(OPEN_AI),
  },
};

export default OpenAIConfig;
