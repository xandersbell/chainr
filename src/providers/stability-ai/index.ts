import type { ProviderConfigs } from '../types';
import StabilityAIAPIConfig from './api';

const StabilityAIConfig: ProviderConfigs = {
  api: StabilityAIAPIConfig,
  responseTransforms: {},
};

export default StabilityAIConfig;
