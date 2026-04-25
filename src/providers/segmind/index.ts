import type { ProviderConfigs } from '../types';
import SegmindAIAPIConfig from './api';

const SegmindConfig: ProviderConfigs = {
  api: SegmindAIAPIConfig,
  responseTransforms: {},
};

export default SegmindConfig;
