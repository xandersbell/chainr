// Aligned with Portkey's transformToProviderRequest + responseHandler
// Uses ProviderConfig parameter mapping to transform request params into provider format
import Providers from '../providers';
import type { endpointStrings, ProviderConfig } from '../providers/types';
import type { Options, Params } from '../types/requestBody';
import {
  getUnsupportedMultimodalRequirement,
  normalizeMultimodalParamsForProvider,
} from './multimodalCapabilities';
import { buildProviderOptions } from './providerOptions';
import type { TransformResult } from './types';

function setNestedProperty(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

const getValue = (
  configParam: string,
  params: Params,
  paramConfig: any,
  providerOptions: Options,
) => {
  let value = params[configParam as keyof typeof params];

  if (paramConfig.transform) {
    value = paramConfig.transform(params, providerOptions);
  }

  if (typeof value === 'number' && paramConfig?.min !== undefined && value < paramConfig.min) {
    value = paramConfig.min;
  } else if (
    typeof value === 'number' &&
    paramConfig?.max !== undefined &&
    value > paramConfig.max
  ) {
    value = paramConfig.max;
  }

  return value;
};

// Aligned with Portkey's transformUsingProviderConfig
export const transformUsingProviderConfig = (
  providerConfig: ProviderConfig,
  params: Params,
  providerOptions: Options,
) => {
  const transformedRequest: { [key: string]: any } = {};

  for (const configParam in providerConfig) {
    let paramConfigs = providerConfig[configParam];
    if (!Array.isArray(paramConfigs)) {
      paramConfigs = [paramConfigs];
    }

    for (const paramConfig of paramConfigs) {
      if (configParam in params) {
        const value = getValue(configParam, params, paramConfig, providerOptions);
        setNestedProperty(transformedRequest, paramConfig?.param as string, value);
      } else if (paramConfig?.required && paramConfig.default !== undefined) {
        let value;
        if (typeof paramConfig.default === 'function') {
          value = paramConfig.default(params, providerOptions);
        } else {
          value = paramConfig.default;
        }
        setNestedProperty(transformedRequest, paramConfig.param, value);
      }
    }
  }

  return transformedRequest;
};

/**
 * Build a complete request (URL + headers + body) using the provider registry
 * Aligned with Portkey's tryPost flow: transformToProviderRequest → getBaseURL + getEndpoint → headers
 */
export async function buildProviderRequest(
  params: Params,
  provider: string,
  target: Record<string, unknown>,
  endpoint: endpointStrings = 'chatComplete',
): Promise<TransformResult> {
  const providerConfigs = Providers[provider];
  if (!providerConfigs) {
    throw new Error(`Provider "${provider}" not found in registry`);
  }

  const apiConfig = providerConfigs.api;
  if (!apiConfig) {
    throw new Error(`Provider "${provider}" has no API config`);
  }

  const providerOptions = buildProviderOptions(provider, target);
  const unsupportedReason = getUnsupportedMultimodalRequirement(provider, params, endpoint, target);
  if (unsupportedReason) {
    throw new Error(`Unsupported multimodal input: ${unsupportedReason}`);
  }

  const normalizedParams = normalizeMultimodalParamsForProvider(params, provider, endpoint);

  // Get the parameter mapping config for the endpoint
  let endpointConfig: ProviderConfig | undefined;
  if (providerConfigs.getConfig) {
    const dynamicConfig = providerConfigs.getConfig({ params: normalizedParams, providerOptions });
    endpointConfig = dynamicConfig?.[endpoint];
  } else {
    endpointConfig = providerConfigs[endpoint];
  }

  // Transform request body (some endpoints like createTranscription may lack ProviderConfig, pass through directly)
  const body =
    endpointConfig && Object.keys(endpointConfig).length > 0
      ? transformUsingProviderConfig(endpointConfig, normalizedParams, providerOptions)
      : { ...normalizedParams };

  // Build URL
  const baseUrl = await apiConfig.getBaseURL({
    providerOptions,
    fn: endpoint,
    gatewayRequestURL: '',
    params: normalizedParams,
  });

  const endpointPath = apiConfig.getEndpoint({
    providerOptions,
    fn: endpoint,
    gatewayRequestBodyJSON: normalizedParams,
    gatewayRequestURL: baseUrl,
  });

  const url = `${baseUrl}${endpointPath}`;

  // Build headers (Bedrock's headers() handles AWS signing internally)
  const headers = await apiConfig.headers({
    providerOptions,
    fn: endpoint,
    transformedRequestBody: body,
    transformedRequestUrl: url,
    gatewayRequestBody: normalizedParams,
  });

  return { body, headers, url };
}

/**
 * Transform response using the provider registry's responseTransforms
 * Aligned with Portkey's responseHandler flow
 * requestModel: the model name from the original request, used for dynamic provider (e.g. Vertex AI) getConfig routing
 */
export function transformProviderResponse(
  json: unknown,
  provider: string,
  endpoint: endpointStrings = 'chatComplete',
  status: number = 200,
  responseHeaders: Record<string, string> = {},
  requestModel?: string,
): unknown {
  // retryRequest returns a { status, data } wrapper; unwrap to get the actual response body
  const responseBody =
    json && typeof json === 'object' && 'data' in json
      ? (json as Record<string, unknown>).data
      : json;

  const providerConfigs = Providers[provider];
  if (!providerConfigs) {
    return responseBody;
  }

  // Get responseTransforms
  let responseTransforms: Record<string, any> | undefined;
  if (providerConfigs.getConfig) {
    // For dynamic providers (e.g. Vertex AI), the request model is needed to route to the correct sub-config
    // The response JSON may not contain a model field, so requestModel takes priority
    const configParams = requestModel
      ? ({ model: requestModel } as Params)
      : (responseBody as Params);
    const dynamicConfig = providerConfigs.getConfig({
      params: configParams,
      providerOptions: { provider } as Options,
    });
    responseTransforms = dynamicConfig?.responseTransforms;
  } else {
    responseTransforms = providerConfigs.responseTransforms;
  }

  const transformFn = responseTransforms?.[endpoint];
  if (!transformFn || typeof transformFn !== 'function') {
    return responseBody;
  }

  // Aligned with Portkey's responseTransformer call signature
  return transformFn(responseBody, status, responseHeaders, false);
}
