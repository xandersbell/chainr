import { ProviderConfigs } from '../types';
import DeepbricksAPIConfig from './api';
import {
  DeepbricksChatCompleteConfig,
  DeepbricksChatCompleteResponseTransform,
} from './chatComplete';
const DeepbricksConfig: ProviderConfigs = {
  api: DeepbricksAPIConfig,
  chatComplete: DeepbricksChatCompleteConfig,
  responseTransforms: {
    chatComplete: DeepbricksChatCompleteResponseTransform,
  },
};

export default DeepbricksConfig;
