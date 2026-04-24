// 从 Portkey 的 transformToProviderRequest.ts 适配
// 使用 ProviderConfig 参数映射将请求参数转换为 provider 格式
import Providers from '../providers';
import type { ProviderConfig } from '../providers/types';
import type { Options, Params } from '../types/requestBody';

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

/**
 * 使用 provider 注册表构建完整请求（URL + headers + body）
 * 返回与旧 transformRequest() 相同的接口
 */
export async function buildProviderRequest(
  params: Params,
  provider: string,
  target: Record<string, unknown>
): Promise<{
  body: Record<string, any>;
  headers: Record<string, string>;
  url: string;
} | null> {
  const providerConfigs = Providers[provider];
  if (!providerConfigs) return null;

  const apiConfig = providerConfigs.api;
  if (!apiConfig) return null;

  // 构建 providerOptions（对齐 Portkey 的 Options 结构）
  const providerOptions: Options = {
    provider,
    apiKey: target['apiKey'] as string,
    ...(target as Record<string, any>),
  };

  // 获取 chatComplete 的参数映射配置
  let chatCompleteConfig: ProviderConfig | undefined;
  if (providerConfigs.getConfig) {
    const dynamicConfig = providerConfigs.getConfig({ params, providerOptions });
    chatCompleteConfig = dynamicConfig?.chatComplete;
  } else {
    chatCompleteConfig = providerConfigs.chatComplete;
  }

  if (!chatCompleteConfig) return null;

  // 转换请求体
  const body = transformUsingProviderConfig(chatCompleteConfig, params, providerOptions);

  // 构建 URL
  const baseURL = await apiConfig.getBaseURL({
    providerOptions,
    fn: 'chatComplete',
    gatewayRequestURL: '',
    params,
  });

  const endpoint = apiConfig.getEndpoint({
    providerOptions,
    fn: 'chatComplete',
    gatewayRequestBodyJSON: params,
    gatewayRequestURL: '',
  });

  const url = `${baseURL}${endpoint}`;

  // 构建 headers
  const headers = await apiConfig.headers({
    providerOptions,
    fn: 'chatComplete',
    transformedRequestBody: body,
    transformedRequestUrl: url,
    gatewayRequestBody: params,
  });

  return { body, headers, url };
}
