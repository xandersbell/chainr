import { ProviderConfigs } from '../types';
import {
  SiliconFlowEmbedConfig,
  SiliconFlowEmbedResponseTransform,
} from './embed';
import SiliconFlowAPIConfig from './api';
import {
  SiliconFlowChatCompleteConfig,
  SiliconFlowChatCompleteResponseTransform,
} from './chatComplete';
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
