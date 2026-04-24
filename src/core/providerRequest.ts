// 对齐 Portkey 的 transformToProviderRequest + responseHandler
// 使用 ProviderConfig 参数映射将请求参数转换为 provider 格式
import Providers from '../providers';
import type { ProviderConfig, endpointStrings } from '../providers/types';
import type { Options, Params } from '../types/requestBody';
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
  providerOptions: Options
) => {
  let value = params[configParam as keyof typeof params];

  if (paramConfig.transform) {
    value = paramConfig.transform(params, providerOptions);
  }

  if (typeof value === 'number' && paramConfig?.min !== undefined && value < paramConfig.min) {
    value = paramConfig.min;
  } else if (typeof value === 'number' && paramConfig?.max !== undefined && value > paramConfig.max) {
    value = paramConfig.max;
  }

  return value;
};

// 对齐 Portkey 的 transformUsingProviderConfig
export const transformUsingProviderConfig = (
  providerConfig: ProviderConfig,
  params: Params,
  providerOptions: Options
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

// 构建 providerOptions（对齐 Portkey 的 Options 结构）
function buildProviderOptions(
  provider: string,
  target: Record<string, unknown>
): Options {
  return {
    provider,
    apiKey: target['apiKey'] as string,
    ...(target as Record<string, any>),
  };
}

/**
 * 使用 provider 注册表构建完整请求（URL + headers + body）
 * 对齐 Portkey 的 tryPost 流程：transformToProviderRequest → getBaseURL + getEndpoint → headers
 */
export async function buildProviderRequest(
  params: Params,
  provider: string,
  target: Record<string, unknown>,
  endpoint: endpointStrings = 'chatComplete'
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

  // 获取 endpoint 对应的参数映射配置
  let endpointConfig: ProviderConfig | undefined;
  if (providerConfigs.getConfig) {
    const dynamicConfig = providerConfigs.getConfig({ params, providerOptions });
    endpointConfig = dynamicConfig?.[endpoint];
  } else {
    endpointConfig = providerConfigs[endpoint];
  }

  // 转换请求体（有些 endpoint 如 createTranscription 可能没有 ProviderConfig，直接透传）
  const body = endpointConfig
    ? transformUsingProviderConfig(endpointConfig, params, providerOptions)
    : { ...params };

  // 构建 URL
  const baseURL = await apiConfig.getBaseURL({
    providerOptions,
    fn: endpoint,
    gatewayRequestURL: '',
    params,
  });

  const endpointPath = apiConfig.getEndpoint({
    providerOptions,
    fn: endpoint,
    gatewayRequestBodyJSON: params,
    gatewayRequestURL: '',
  });

  const url = `${baseURL}${endpointPath}`;

  // 构建 headers（bedrock 的 headers() 内部已处理 AWS 签名）
  const headers = await apiConfig.headers({
    providerOptions,
    fn: endpoint,
    transformedRequestBody: body,
    transformedRequestUrl: url,
    gatewayRequestBody: params,
  });

  return { body, headers, url };
}

/**
 * 使用 provider 注册表的 responseTransforms 转换响应
 * 对齐 Portkey 的 responseHandler 流程
 */
export function transformProviderResponse(
  json: unknown,
  provider: string,
  endpoint: endpointStrings = 'chatComplete',
  status: number = 200,
  responseHeaders: Record<string, string> = {}
): unknown {
  const providerConfigs = Providers[provider];
  if (!providerConfigs) {
    // 未注册的 provider，直接返回原始响应
    return json;
  }

  // 获取 responseTransforms
  let responseTransforms: Record<string, any> | undefined;
  if (providerConfigs.getConfig) {
    const dynamicConfig = providerConfigs.getConfig({
      params: json as Params,
      providerOptions: { provider } as Options,
    });
    responseTransforms = dynamicConfig?.responseTransforms;
  } else {
    responseTransforms = providerConfigs.responseTransforms;
  }

  const transformFn = responseTransforms?.[endpoint];
  if (!transformFn || typeof transformFn !== 'function') {
    // 没有转换函数（如 OpenAI-compatible provider），直接返回
    return json;
  }

  // 对齐 Portkey 的 responseTransformer 调用签名
  return transformFn(json, status, responseHeaders, false);
}
