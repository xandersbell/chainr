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
// 用户可以在 target 中使用 providerOptions 嵌套对象传递 provider 特定字段，
// 这里将其展平到顶层，与 Options 接口对齐
function buildProviderOptions(
  provider: string,
  target: Record<string, unknown>
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
 * requestModel: 原始请求中的模型名，用于动态 provider（如 Vertex AI）的 getConfig 路由
 */
export function transformProviderResponse(
  json: unknown,
  provider: string,
  endpoint: endpointStrings = 'chatComplete',
  status: number = 200,
  responseHeaders: Record<string, string> = {},
  requestModel?: string
): unknown {
  // retryRequest 返回 { status, data } 包装结构，解包取实际响应体
  const responseBody = (json && typeof json === 'object' && 'data' in json)
    ? (json as Record<string, unknown>).data
    : json;

  const providerConfigs = Providers[provider];
  if (!providerConfigs) {
    return responseBody;
  }

  // 获取 responseTransforms
  let responseTransforms: Record<string, any> | undefined;
  if (providerConfigs.getConfig) {
    // 对于动态 provider（如 Vertex AI），需要用请求的 model 来路由到正确的子配置
    // 响应 JSON 中可能没有 model 字段，所以优先使用 requestModel
    const configParams = requestModel
      ? { model: requestModel } as Params
      : responseBody as Params;
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

  // 对齐 Portkey 的 responseTransformer 调用签名
  return transformFn(responseBody, status, responseHeaders, false);
}
