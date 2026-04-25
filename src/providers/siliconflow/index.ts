import type { ProviderConfigs } from '../types';
import SiliconFlowAPIConfig from './api';
import {
  SiliconFlowChatCompleteConfig,
  SiliconFlowChatCompleteResponseTransform,
} from './chatComplete';
import { SiliconFlowEmbedConfig, SiliconFlowEmbedResponseTransform } from './embed';

const SiliconFlowConfig: ProviderConfigs = {
  embed: SiliconFlowEmbedConfig,
  api: SiliconFlowAPIConfig,
  chatComplete: SiliconFlowChatCompleteConfig,
  responseTransforms: {
    chatComplete: SiliconFlowChatCompleteResponseTransform,
    embed: SiliconFlowEmbedResponseTransform,
  },
};

export default SiliconFlowConfig;
