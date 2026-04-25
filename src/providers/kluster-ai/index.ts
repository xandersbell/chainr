import { KLUSTER_AI } from '../../globals';
import { chatCompleteParams, embedParams, responseTransformers } from '../open-ai-base';
import type { ProviderConfigs } from '../types';
import KlusterAIAPIConfig from './api';
import { KlusterAIResponseTransform } from './chatComplete';

const KlusterAIConfig: ProviderConfigs = {
  chatComplete: chatCompleteParams(
    [],
    { model: 'klusterai/Meta-Llama-3.1-8B-Instruct-Turbo' },
    {
      store: {
        param: 'store',
      },
      metadata: {
        param: 'metadata',
        required: true,
      },
    },
  ),
  embed: embedParams([], {
    model: 'klusterai/Meta-Llama-3.1-8B-Instruct-Turbo',
  }),
  api: KlusterAIAPIConfig,
  responseTransforms: {
    ...responseTransformers(KLUSTER_AI, {
      chatComplete: true,
      embed: true,
    }),
    uploadFile: KlusterAIResponseTransform,
  },
};

export default KlusterAIConfig;
