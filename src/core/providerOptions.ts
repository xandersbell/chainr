import type { Options } from '../types/requestBody';

export function buildProviderOptions(
  provider: string,
  target: Record<string, unknown> = {},
): Options {
  const { providerOptions, ...rest } = target;

  return {
    provider,
    apiKey: (target['apiKey'] ?? target['api_key']) as string,
    ...rest,
    ...(providerOptions && typeof providerOptions === 'object'
      ? (providerOptions as Record<string, unknown>)
      : {}),
  };
}
