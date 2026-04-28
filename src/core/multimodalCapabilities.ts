import Providers from '../providers';
import type { endpointStrings } from '../providers/types';
import type {
  ContentType,
  Message,
  Params,
  ResponseInputAudioContent,
  ResponseInput,
  ResponseInputContent,
  ResponseInputFileContent,
  ResponseInputImageContent,
  ResponseInputItem,
  ResponseInputMessage,
} from '../types/requestBody';
import { getMessageContentBlocks } from './messageContent';
import { buildProviderOptions } from './providerOptions';
import type { TargetConfig } from './types';

type MediaKind = 'image' | 'audio' | 'video' | 'document' | 'unknown';
type SourceKind = 'https-url' | 'gcs-url' | 's3-url' | 'base64' | 'file-id' | 'unknown';

interface MultimodalRequirement {
  type: string;
  mediaKind: MediaKind;
  sourceKind: SourceKind;
  mimeType?: string;
  needsExplicitMimeType?: boolean;
}

type ResponseLikeContent =
  | ResponseInputContent
  | ResponseInputAudioContent
  | ContentType
  | Record<string, unknown>;

const getFileUrl = (item: ContentType): string | undefined => item.file?.url ?? item.file?.file_url;

const getFileData = (item: ContentType): string | undefined =>
  item.file?.data ?? item.file?.file_data;

const getVideoUrl = (item: ContentType): string | undefined => {
  if (typeof item.video_url === 'string') return item.video_url;
  return item.video_url?.url;
};

const getMimeFromDataUrl = (value?: string): string | undefined => {
  if (!value?.startsWith('data:')) return undefined;
  return value.split(';base64,')[0]?.replace('data:', '');
};

const hasExplicitMimeType = (item: ContentType): boolean =>
  Boolean(
    item.mime_type ??
      item.file?.mime_type ??
      getMimeFromDataUrl(getFileUrl(item)) ??
      getMimeFromDataUrl(getFileData(item)),
  );

const getSourceKind = (url?: string, data?: string, fileId?: string): SourceKind => {
  if (fileId) return 'file-id';
  if (data || url?.startsWith('data:')) return 'base64';
  if (url?.startsWith('gs://')) return 'gcs-url';
  if (url?.startsWith('s3://')) return 's3-url';
  if (url?.startsWith('https://') || url?.startsWith('http://')) return 'https-url';
  if (url) return 'unknown';
  return 'unknown';
};

const getRequirementNeedsExplicitMimeType = (item: ContentType, sourceKind: SourceKind): boolean =>
  sourceKind !== 'file-id' && !hasExplicitMimeType(item);

const getMediaKind = (mimeType?: string): MediaKind => {
  if (!mimeType) return 'unknown';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return 'document';
  if (mimeType.includes('document') || mimeType.includes('spreadsheet')) return 'document';
  return 'unknown';
};

const toDataUrl = (data: string, mimeType?: string) =>
  mimeType && !data.startsWith('data:') ? `data:${mimeType};base64,${data}` : data;

const getAudioFormat = (mimeType?: string): string => {
  if (mimeType?.includes('wav')) return 'wav';
  return 'mp3';
};

const isOpenAIProvider = (provider: string): boolean =>
  provider === 'openai' || provider === 'azure-openai';

const supportsEndpoint = (
  provider: string,
  endpoint: endpointStrings,
  params: Params,
  target?: Record<string, unknown>,
): boolean => {
  const providerConfig = Providers[provider];
  if (!providerConfig) return false;

  if (providerConfig.getConfig) {
    const dynamicConfig = providerConfig.getConfig({
      params,
      providerOptions: buildProviderOptions(provider, target),
    });
    return endpoint in dynamicConfig;
  }

  return endpoint in providerConfig;
};

const hasLegacyFileFields = (item: ContentType): boolean =>
  Boolean(
    item.file?.url ??
      item.file?.data ??
      item.file?.file_url ??
      item.file?.file_name ??
      item.file?.mime_type,
  );

const getResponseInputFileUrl = (item: ResponseInputFileContent): string | undefined => item.file_url;

const getResponseInputFileData = (item: ResponseInputFileContent): string | undefined => item.file_data;

const getResponseInputImageUrl = (item: ResponseInputImageContent): string | undefined =>
  item.image_url;

const isResponseInputMessage = (item: ResponseInputItem | Record<string, unknown>): item is ResponseInputMessage =>
  typeof item === 'object' &&
  item !== null &&
  'role' in item &&
  'content' in item &&
  (!('type' in item) || item.type === 'message');

const isResponseInputImageContent = (item: ResponseLikeContent): item is ResponseInputImageContent =>
  typeof item === 'object' &&
  item !== null &&
  'type' in item &&
  item.type === 'input_image' &&
  !('file' in item);

const isResponseInputAudioContent = (
  item: ResponseLikeContent,
): item is ResponseInputAudioContent =>
  typeof item === 'object' &&
  item !== null &&
  'type' in item &&
  item.type === 'input_audio' &&
  'input_audio' in item;

const isResponseInputFileContent = (item: ResponseLikeContent): item is ResponseInputFileContent =>
  typeof item === 'object' &&
  item !== null &&
  'type' in item &&
  item.type === 'input_file' &&
  !('file' in item);

const getResponseInputContents = (input?: Params['input']): ResponseLikeContent[] => {
  if (!Array.isArray(input)) return [];

  const contents: ResponseLikeContent[] = [];

  for (const item of input as ResponseInput) {
    if (typeof item !== 'object' || item === null) continue;

    if (isResponseInputMessage(item)) {
      if (Array.isArray(item.content)) {
        contents.push(...item.content);
      }
      continue;
    }

    contents.push(item as ResponseLikeContent);
  }

  return contents;
};

function getOpenAIChatShapeError(provider: string, params: Params): string | undefined {
  for (const message of params.messages ?? []) {
    const content = getMessageContentBlocks(message);
    if (!content) continue;

    for (const item of content) {
      if (item.type === 'input_file') {
        return `${provider} chatComplete does not accept provider-specific input_file content; use image_url or file`;
      }

      if (item.type === 'file' && hasLegacyFileFields(item)) {
        return `${provider} chatComplete file content must use file_data, file_id, and filename only`;
      }
    }
  }

  return undefined;
}

function getOpenAIResponsesShapeError(provider: string, params: Params): string | undefined {
  for (const item of getResponseInputContents(params.input)) {
    if (item.type === 'image_url') {
      return `${provider} createModelResponse does not accept image_url content; use input_image`;
    }

    if (item.type === 'file') {
      return `${provider} createModelResponse does not accept file content; use input_file`;
    }

    if (item.type === 'input_file' && 'file' in item) {
      return `${provider} createModelResponse input_file must use file_data, file_id, file_url, and filename`;
    }

    if (item.type === 'input_audio') {
      return `${provider} createModelResponse does not support input_audio content`;
    }

    if (provider === 'azure-openai' && isResponseInputImageContent(item) && item.file_id) {
      return `${provider} createModelResponse input_image must use image_url with a URL or data URL`;
    }

    if (item.type === 'input_image' && typeof item.image_url === 'object') {
      return `${provider} createModelResponse input_image.image_url must be a string`;
    }
  }

  return undefined;
}

function getNativeShapeError(
  provider: string,
  params: Params,
  endpoint: endpointStrings,
): string | undefined {
  if (!isOpenAIProvider(provider)) return undefined;
  if (endpoint === 'chatComplete') return getOpenAIChatShapeError(provider, params);
  if (endpoint === 'createModelResponse') return getOpenAIResponsesShapeError(provider, params);
  return undefined;
}

function getEndpointSupportError(
  provider: string,
  params: Params,
  endpoint: endpointStrings,
  target?: Record<string, unknown>,
): string | undefined {
  if (!supportsEndpoint(provider, endpoint, params, target)) {
    return `${provider} does not support ${endpoint}`;
  }

  return undefined;
}

export function inferMultimodalRequirements(params: Params): MultimodalRequirement[] {
  const requirements: MultimodalRequirement[] = [];

  for (const message of params.messages ?? []) {
    const content = getMessageContentBlocks(message);
    if (!content) continue;

    for (const item of content) {
      if (item.type === 'image_url') {
        const url = item.image_url?.url;
        const mimeType = item.image_url?.mime_type ?? getMimeFromDataUrl(url) ?? 'image/*';
        requirements.push({
          type: item.type,
          mediaKind: 'image',
          sourceKind: getSourceKind(url),
          mimeType,
        });
      } else if (item.type === 'input_audio') {
        requirements.push({
          type: item.type,
          mediaKind: 'audio',
          sourceKind: 'base64',
          mimeType: `audio/${item.input_audio?.format ?? 'unknown'}`,
        });
      } else if (item.type === 'file' || item.type === 'input_file') {
        const url = getFileUrl(item);
        const data = getFileData(item);
        const sourceKind = getSourceKind(url, data, item.file?.file_id);
        const mimeType =
          item.file?.mime_type ?? getMimeFromDataUrl(url) ?? getMimeFromDataUrl(data);
        requirements.push({
          type: item.type,
          mediaKind: getMediaKind(mimeType),
          sourceKind,
          mimeType,
          needsExplicitMimeType: getRequirementNeedsExplicitMimeType(item, sourceKind),
        });
      } else if (item.type === 'input_video' || item.type === 'video_url') {
        const url = getVideoUrl(item);
        const mimeType = item.mime_type ?? getMimeFromDataUrl(url) ?? 'video/*';
        requirements.push({
          type: item.type,
          mediaKind: 'video',
          sourceKind: getSourceKind(url),
          mimeType,
          needsExplicitMimeType: !item.mime_type && !getMimeFromDataUrl(url),
        });
      }
    }
  }

  for (const item of getResponseInputContents(params.input)) {
    if (isResponseInputImageContent(item)) {
      const url = getResponseInputImageUrl(item);
      requirements.push({
        type: item.type,
        mediaKind: 'image',
        sourceKind: getSourceKind(url, undefined, item.file_id ?? undefined),
        mimeType: getMimeFromDataUrl(url) ?? 'image/*',
      });
    } else if (isResponseInputAudioContent(item)) {
      requirements.push({
        type: item.type,
        mediaKind: 'audio',
        sourceKind: 'base64',
        mimeType: `audio/${item.input_audio?.format ?? 'unknown'}`,
      });
    } else if (isResponseInputFileContent(item)) {
      const url = getResponseInputFileUrl(item);
      const data = getResponseInputFileData(item);
      requirements.push({
        type: item.type,
        mediaKind: 'unknown',
        sourceKind: getSourceKind(url, data, item.file_id),
      });
    }
  }

  return requirements;
}

const sourceIs = (requirement: MultimodalRequirement, sources: SourceKind[]) =>
  sources.includes(requirement.sourceKind);

function providerSupportsRequirement(
  provider: string,
  endpoint: endpointStrings,
  requirement: MultimodalRequirement,
): boolean {
  if (requirement.needsExplicitMimeType) return false;

  if (provider === 'google' || provider === 'vertex-ai') {
    return sourceIs(requirement, ['https-url', 'gcs-url', 'base64']);
  }

  if (provider === 'openrouter') {
    if (requirement.mediaKind === 'audio') return sourceIs(requirement, ['base64']);
    return sourceIs(requirement, ['https-url', 'base64', 'file-id']);
  }

  if (provider === 'openai') {
    if (requirement.mediaKind === 'video') return false;
    if (requirement.mediaKind === 'audio') return sourceIs(requirement, ['base64']);
    if (requirement.mediaKind === 'image')
      return sourceIs(requirement, ['https-url', 'base64', 'file-id']);
    if (endpoint === 'createModelResponse') {
      return sourceIs(requirement, ['https-url', 'base64', 'file-id']);
    }
    return sourceIs(requirement, ['base64', 'file-id']);
  }

  if (provider === 'azure-openai') {
    if (requirement.mediaKind === 'video') return false;
    if (requirement.mediaKind === 'audio') return sourceIs(requirement, ['base64']);
    if (requirement.mediaKind === 'image') return sourceIs(requirement, ['https-url', 'base64']);
    if (endpoint === 'createModelResponse') {
      return sourceIs(requirement, ['https-url', 'base64', 'file-id']);
    }
    return sourceIs(requirement, ['base64', 'file-id']);
  }

  if (provider === 'anthropic') {
    if (requirement.mediaKind === 'image') return sourceIs(requirement, ['https-url', 'base64']);
    if (requirement.mediaKind === 'document') return sourceIs(requirement, ['https-url', 'base64']);
    return false;
  }

  if (provider === 'bedrock') {
    return sourceIs(requirement, ['base64', 's3-url']);
  }

  if (requirement.mediaKind === 'video') return false;
  if (requirement.mediaKind === 'audio') return sourceIs(requirement, ['base64']);
  if (requirement.mediaKind === 'image') return sourceIs(requirement, ['https-url', 'base64']);
  return sourceIs(requirement, ['base64', 'file-id']);
}

export function getUnsupportedMultimodalRequirement(
  provider: string,
  params: Params,
  endpoint: endpointStrings = 'chatComplete',
  target?: Record<string, unknown>,
): string | undefined {
  const endpointError = getEndpointSupportError(provider, params, endpoint, target);
  if (endpointError) return endpointError;

  const shapeError = getNativeShapeError(provider, params, endpoint);
  if (shapeError) return shapeError;

  for (const requirement of inferMultimodalRequirements(params)) {
    if (requirement.needsExplicitMimeType) {
      return `${requirement.type} requires an explicit MIME type for reliable multimodal routing`;
    }

    if (!providerSupportsRequirement(provider, endpoint, requirement)) {
      return `${provider} does not support ${requirement.mediaKind} input from ${requirement.sourceKind}${
        requirement.mimeType ? ` (${requirement.mimeType})` : ''
      } on ${endpoint}`;
    }
  }

  return undefined;
}

function normalizeOpenAIChatContent(item: ContentType): ContentType {
  if (item.type === 'image_url' && item.image_url) {
    return {
      ...item,
      image_url: {
        url: item.image_url.url,
        ...(item.image_url.detail && { detail: item.image_url.detail }),
      },
    };
  }

  return item;
}

function normalizeOpenRouterContent(item: ContentType): ContentType {
  if (item.type !== 'input_file') return item;

  const url = getFileUrl(item);
  const data = getFileData(item);
  const mimeType = item.file?.mime_type;
  const mediaKind = getMediaKind(mimeType);

  if (mediaKind === 'video' && (url || data)) {
    return {
      type: 'input_video',
      video_url: url ?? toDataUrl(data ?? '', mimeType),
      ...(mimeType && { mime_type: mimeType }),
      ...(item.video_metadata && { video_metadata: item.video_metadata }),
    };
  }

  if (mediaKind === 'image' && (url || data)) {
    return {
      type: 'image_url',
      image_url: {
        url: url ?? toDataUrl(data ?? '', mimeType),
        ...(mimeType && { mime_type: mimeType }),
      },
    };
  }

  if (mediaKind === 'audio' && data) {
    return {
      type: 'input_audio',
      input_audio: {
        data,
        format: getAudioFormat(mimeType),
      },
    };
  }

  return {
    type: 'file',
    file: {
      ...(data && { file_data: data }),
      ...(url && { file_data: url }),
      ...(item.file?.file_id && { file_id: item.file.file_id }),
      ...((item.file?.filename ?? item.file?.file_name) && {
        filename: item.file?.filename ?? item.file?.file_name,
      }),
      ...(mimeType && { mime_type: mimeType }),
    },
  };
}

function normalizeMessageContent(
  message: Message,
  normalizeContent: (item: ContentType) => ContentType,
): Message {
  const content = message.content;
  const contentBlocks = message.content_blocks;

  return {
    ...message,
    ...(Array.isArray(content) && {
      content: content.map(normalizeContent),
    }),
    ...(Array.isArray(contentBlocks) && {
      content_blocks: contentBlocks.map(normalizeContent),
    }),
  };
}

export function normalizeMultimodalParamsForProvider(
  params: Params,
  provider: string,
  endpoint: endpointStrings = 'chatComplete',
): Params {
  if (!params.messages?.length || endpoint !== 'chatComplete') return params;

  if (provider === 'openai' || provider === 'azure-openai') {
    return {
      ...params,
      messages: params.messages.map((message) =>
        normalizeMessageContent(message, normalizeOpenAIChatContent),
      ),
    };
  }

  if (provider === 'openrouter') {
    return {
      ...params,
      messages: params.messages.map((message) =>
        normalizeMessageContent(message, normalizeOpenRouterContent),
      ),
    };
  }

  return params;
}

export function targetSupportsMultimodalRequest(
  target: TargetConfig,
  params: Params,
  endpoint: endpointStrings = 'chatComplete',
): boolean {
  const effectiveParams = { ...params, ...(target.overrideParams || {}) } as Params;

  if (target.strategy && Array.isArray(target.targets)) {
    return target.targets.some((child) =>
      targetSupportsMultimodalRequest(child, effectiveParams, endpoint),
    );
  }

  const provider = (target.provider as string) || 'openai';
  return !getUnsupportedMultimodalRequirement(provider, effectiveParams, endpoint, target);
}

export function getTargetMultimodalUnsupportedReason(
  target: TargetConfig,
  params: Params,
  endpoint: endpointStrings = 'chatComplete',
): string | undefined {
  const effectiveParams = { ...params, ...(target.overrideParams || {}) } as Params;

  if (target.strategy && Array.isArray(target.targets)) {
    const childReasons = target.targets
      .map((child) => getTargetMultimodalUnsupportedReason(child, effectiveParams, endpoint))
      .filter(Boolean);
    return childReasons.length === target.targets.length ? childReasons.join('; ') : undefined;
  }

  const provider = (target.provider as string) || 'openai';
  return getUnsupportedMultimodalRequirement(provider, effectiveParams, endpoint, target);
}

export function formatMultimodalCapabilityReport(
  targets: TargetConfig[],
  params: Params,
  endpoint: endpointStrings = 'chatComplete',
): string {
  return targets
    .map((target, index) => {
      const name = target.name ? `${target.name} ` : '';
      const provider = target.provider ?? target.strategy ?? 'openai';
      const reason =
        getTargetMultimodalUnsupportedReason(target, params, endpoint) ??
        'supports the requested multimodal input';
      return `target ${index} (${name}${provider}): ${reason}`;
    })
    .join('; ');
}
