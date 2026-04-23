import type { SplitPatternType } from './types/streaming';

export { SplitPatternType };

export function getSplitPattern(provider: string, requestURL?: string): SplitPatternType {
  if (provider === 'cohere' && requestURL) {
    return requestURL.includes('/chat') ? '\n\n' : '\n';
  }

  const splitPatterns: Record<string, SplitPatternType> = {
    'openai': '\n\n',
    'openrouter': '\n\n',
    'together-ai': '\n\n',
    'perplexity': '\r\n\r\n',
    'groq': '\n\n',
    'deepseek': '\n\n',
    'mistral-ai': '\n\n',
    'anthropic': requestURL?.includes('/complete') ? '\r\n\r\n' : '\n\n',
    'vertex-ai': '\r\n\r\n',
    'google': '\r\n',
    'deepinfra': '\n',
    'sambanova': '\n',
    'bytez': ' ',
    'azure-openai': '\n\n',
    'cerebras': '\n\n',
    'upstage': '\n\n',
    'reka-ai': '\n\n',
    'monster-api': '\n\n',
    'inference-net': '\n\n',
    'nscale': '\n\n',
    'dashscope': '\n\n',
    'deepbricks': '\n\n',
    'lambda': '\n\n',
    'siliconflow': '\n\n',
    'x-ai': '\n\n',
    'nebius': '\n\n',
    'featherless-ai': '\n\n',
    'ai21': '\n\n',
    'stability-ai': '\n\n',
    'triton': '\n\n',
    'replicate': '\n\n',
    'modal': '\n\n',
    'github': '\n\n',
    'azure-ai': '\n\n',
    'aibadgr': '\n\n',
  };

  return splitPatterns[provider] ?? '\n\n';
}

export function getFallbackChunkId(provider: string): string {
  return `${provider}-${Date.now().toString()}`;
}