import { GROQ } from '../../globals';
import { chatCompleteParams, createSpeechParams, responseTransformers } from '../open-ai-base';
import type { ProviderConfigs } from '../types';
import GroqAPIConfig from './api';
import { GroqChatCompleteStreamChunkTransform } from './chatComplete';

const GroqConfig: ProviderConfigs = {
  api: GroqAPIConfig,
  chatComplete: chatCompleteParams(['logprobs', 'logits_bias', 'top_logprobs'], undefined, {
    service_tier: { param: 'service_tier', required: false },
    reasoning_effort: { param: 'reasoning_effort', required: false },
  }),
  createTranscription: {},
  createTranslation: {},
  createSpeech: createSpeechParams([]),
  responseTransforms: {
    ...responseTransformers(GROQ, {
      chatComplete: true,
      createSpeech: true,
    }),
    'stream-chatComplete': GroqChatCompleteStreamChunkTransform,
  },
};

export default GroqConfig;
