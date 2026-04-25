import { IO_INTELLIGENCE } from '../../globals';
import {
  chatCompleteParams,
  createModelResponseParams,
  embedParams,
  responseTransformers,
} from '../open-ai-base';
import type { ProviderConfigs } from '../types';
import IOIntelligenceAPIConfig from './api';

const IOIntelligenceConfig: ProviderConfigs = {
  api: IOIntelligenceAPIConfig,
  chatComplete: chatCompleteParams([]),
  embed: embedParams([]),
  createModelResponse: createModelResponseParams([]),
  getModelResponse: {},
  listModelsResponse: {},
  responseTransforms: {
    ...responseTransformers(IO_INTELLIGENCE, {
      chatComplete: true,
      embed: true,
    }),
  },
};

export default IOIntelligenceConfig;
