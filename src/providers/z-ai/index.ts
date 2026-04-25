import { Z_AI } from '../../globals';
import { chatCompleteParams, responseTransformers } from '../open-ai-base';
import type { ProviderConfigs } from '../types';
import ZAIAPIConfig from './api';

const ZAIConfig: ProviderConfigs = {
  chatComplete: chatCompleteParams([], { model: 'glm-4.6' }),
  api: ZAIAPIConfig,
  responseTransforms: {
    ...responseTransformers(Z_AI, {
      chatComplete: true,
    }),
  },
};

export default ZAIConfig;
