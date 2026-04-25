import { GatewayError } from '../../errors/GatewayError';
import type { Options } from '../../types/requestBody';
import type { endpointStrings, ProviderAPIConfig } from '../types';
import { getModelAndProvider, getAccessToken, getBucketAndFile, getAccessTokenFromADC } from './utils';

const getApiVersion = (provider: string) => {
  if (provider === 'meta') return 'v1beta1';
  return 'v1';
};

const getProjectRoute = (
  providerOptions: Options,
  inputModel: string
): string => {
  const {
    vertexProjectId: inputProjectId,
    vertexRegion,
    vertexServiceAccountJson,
  } = providerOptions;
  let projectId = inputProjectId;
  if (vertexServiceAccountJson && vertexServiceAccountJson.project_id) {
    projectId = vertexServiceAccountJson.project_id as string;
  }

  const { provider } = getModelAndProvider(inputModel as string);
  const routeVersion = getApiVersion(provider);
  return `/${routeVersion}/projects/${projectId}/locations/${vertexRegion}`;
};

const FILE_ENDPOINTS = [
  'uploadFile',
  'retrieveFileContent',
  'deleteFile',
  'listFiles',
  'retrieveFile',
];

const BATCH_ENDPOINTS = [
  'createBatch',
  'retrieveBatch',
  'getBatchOutput',
  'listBatches',
  'cancelBatch',
  'createFinetune',
  'retrieveFinetune',
  'listFinetunes',
  'cancelFinetune',
];
const NON_INFERENCE_ENDPOINTS = [...FILE_ENDPOINTS, ...BATCH_ENDPOINTS];

// Good reference for using REST: https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart-multimodal#gemini-beginner-samples-drest
// Difference versus Studio AI: https://cloud.google.com/vertex-ai/docs/start/ai-platform-users
export const GoogleApiConfig: ProviderAPIConfig = {
  getBaseURL: ({ providerOptions, fn }) => {
    const { vertexRegion } = providerOptions;

    if (FILE_ENDPOINTS.includes(fn as string)) {
      return `https://storage.googleapis.com`;
    }

    if (vertexRegion === 'global') {
      return 'https://aiplatform.googleapis.com';
    }

    return `https://${vertexRegion}-aiplatform.googleapis.com`;
  },
  headers: async ({ providerOptions, gatewayRequestBody }) => {
    const { apiKey, vertexServiceAccountJson } = providerOptions;
    let authToken = apiKey;

    if (vertexServiceAccountJson) {
      // Method 1: Explicitly provided service account JSON
      authToken = await getAccessToken(vertexServiceAccountJson as Record<string, any>);
    } else if (!apiKey) {
    // Method 2: ADC auto-discovery (local development scenario)
    // When neither apiKey nor vertexServiceAccountJson is provided,
    // automatically read credentials from GOOGLE_APPLICATION_CREDENTIALS or ~/.config/gcloud/
      const adcResult = await getAccessTokenFromADC();
      if (adcResult) {
        authToken = adcResult.token;
        // If user did not specify vertexProjectId, try to get it from ADC credentials
        if (!providerOptions.vertexProjectId && adcResult.projectId) {
          providerOptions.vertexProjectId = adcResult.projectId;
        }
      }
    }
    const anthropicBeta =
      providerOptions?.['anthropicBeta'] ??
      gatewayRequestBody?.['anthropic_beta'];

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...(anthropicBeta && {
        'anthropic-beta': anthropicBeta,
      }),
    };
  },
  getEndpoint: ({
    fn,
    gatewayRequestBodyJSON: gatewayRequestBody,
    providerOptions,
    gatewayRequestURL,
  }) => {
    const { vertexProjectId, vertexRegion, vertexServiceAccountJson } =
      providerOptions;
    let mappedFn = fn;
    const { model: inputModel, stream } = gatewayRequestBody;
    if (stream) {
      mappedFn = `stream-${fn}` as endpointStrings;
    }

    const url = gatewayRequestURL ? new URL(gatewayRequestURL) : null;
    const searchParams = url?.searchParams ?? new URLSearchParams();

    if (NON_INFERENCE_ENDPOINTS.includes(fn)) {
      const jobIdIndex = [
        'cancelBatch',
        'retrieveFileContent',
        'cancelFinetune',
      ].includes(fn)
        ? -2
        : -1;
      const jobId = gatewayRequestURL.split('/').at(jobIdIndex);

      const url = gatewayRequestURL ? new URL(gatewayRequestURL) : null;
      const params = new URLSearchParams(url?.search ?? '');
      const pageSize = params.get('limit') ?? 20;
      const after = params.get('after') ?? '';

      let projectId = vertexProjectId;
      if (!projectId || vertexServiceAccountJson) {
        projectId = vertexServiceAccountJson?.project_id as string | undefined;
      }
      switch (fn) {
        case 'retrieveBatch':
          return `/v1/projects/${projectId}/locations/${vertexRegion}/batchPredictionJobs/${jobId}`;
        case 'listBatches': {
          return `/v1/projects/${projectId}/locations/${vertexRegion}/batchPredictionJobs?pageSize=${pageSize}&pageToken=${after}`;
        }
        case 'cancelBatch': {
          return `/v1/projects/${projectId}/locations/${vertexRegion}/batchPredictionJobs/${jobId}:cancel`;
        }
        case 'uploadFile':
        case 'getBatchOutput':
          // We handle file upload in a separate request handler
          return '';
        case 'retrieveFile':
          return '';
        case 'retrieveFileContent': {
          const { bucket, file } = getBucketAndFile(jobId ?? '');
          return `/${bucket}/${file}`;
        }
        case 'createBatch':
          return `/v1/projects/${projectId}/locations/${vertexRegion}/batchPredictionJobs`;
        case 'createFinetune':
          return `/v1/projects/${projectId}/locations/${vertexRegion}/tuningJobs`;
        case 'listFinetunes': {
          const pageSize = searchParams.get('limit') ?? 20;
          const after = searchParams.get('after') ?? '';
          return `/v1/projects/${projectId}/locations/${vertexRegion}/tuningJobs?pageSize=${pageSize}&pageToken=${after}`;
        }
        case 'retrieveFinetune':
          return `/v1/projects/${projectId}/locations/${vertexRegion}/tuningJobs/${jobId}`;
        case 'cancelFinetune': {
          return `/v1/projects/${projectId}/locations/${vertexRegion}/tuningJobs/${jobId}:cancel`;
        }
        default:
          return '';
      }
    }

    if (!inputModel) {
      throw new GatewayError('Model is required', 400);
    }

    const { provider, model } = getModelAndProvider(inputModel as string);
    const projectRoute = getProjectRoute(providerOptions, inputModel as string);
    const googleUrlMap = new Map<string, string>([
      [
        'chatComplete',
        `${projectRoute}/publishers/${provider}/models/${model}:generateContent`,
      ],
      [
        'stream-chatComplete',
        `${projectRoute}/publishers/${provider}/models/${model}:streamGenerateContent?alt=sse`,
      ],
      [
        'embed',
        `${projectRoute}/publishers/${provider}/models/${model}:predict`,
      ],
      [
        'imageGenerate',
        `${projectRoute}/publishers/${provider}/models/${model}:predict`,
      ],
    ]);

    switch (provider) {
      case 'google': {
        return googleUrlMap.get(mappedFn) || `${projectRoute}`;
      }

      case 'mistralai':
      case 'anthropic': {
        if (mappedFn === 'chatComplete' || mappedFn === 'messages') {
          return `${projectRoute}/publishers/${provider}/models/${model}:rawPredict`;
        } else if (
          mappedFn === 'stream-chatComplete' ||
          mappedFn === 'stream-messages'
        ) {
          return `${projectRoute}/publishers/${provider}/models/${model}:streamRawPredict`;
        } else if (mappedFn === 'messagesCountTokens') {
          return `${projectRoute}/publishers/${provider}/models/count-tokens:rawPredict`;
        }
        return `${projectRoute}/publishers/${provider}/models/${model}:rawPredict`;
      }

      case 'meta': {
        return `${projectRoute}/endpoints/openapi/chat/completions`;
      }

      case 'endpoints': {
        return `${projectRoute}/endpoints/${model}/chat/completions`;
      }

      default:
        return `${projectRoute}`;
    }
  },
};

export default GoogleApiConfig;
