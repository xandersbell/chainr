import { ProviderConfigs } from '../types';
import LeptonAPIConfig from './api';
import {
  LeptonChatCompleteConfig,
  LeptonChatCompleteResponseTransform,
  LeptonChatCompleteStreamChunkTransform,
} from './chatComplete';
import {
  LeptonCompleteConfig,
  LeptonCompleteResponseTransform,
  LeptonCompleteStreamChunkTransform,
} from './complete';
const LeptonConfig: ProviderConfigs = {
  chatComplete: LeptonChatCompleteConfig,
  complete: LeptonCompleteConfig,
  api: LeptonAPIConfig,
  responseTransforms: {
    chatComplete: LeptonChatCompleteResponseTransform,
    'stream-chatComplete': LeptonChatCompleteStreamChunkTransform,
    complete: LeptonCompleteResponseTransform,
    'stream-complete': LeptonCompleteStreamChunkTransform,
  },
};

export default LeptonConfig;
