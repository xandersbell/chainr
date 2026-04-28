import type { endpointStrings } from '../providers/types';
import type { ContentType, Message, Params } from '../types/requestBody';
import { getMessageContentBlocks } from './messageContent';
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

  if (provider === 'openai' || provider === 'azure-openai') {
    if (requirement.mediaKind === 'video') return false;
    if (requirement.mediaKind === 'audio') return sourceIs(requirement, ['base64']);
    if (requirement.mediaKind === 'image')
      return sourceIs(requirement, ['https-url', 'base64', 'file-id']);
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
): string | undefined {
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
  if (item.type !== 'input_file') return item;

  const url = getFileUrl(item);
  const data = getFileData(item);
  const mimeType = item.file?.mime_type;
  const mediaKind = getMediaKind(mimeType);

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

  if ((mediaKind === 'document' || item.file?.file_id) && (data || item.file?.file_id)) {
    return {
      type: 'file',
      file: {
        ...(data && { file_data: data }),
        ...(item.file?.file_id && { file_id: item.file.file_id }),
        ...((item.file?.filename ?? item.file?.file_name) && {
          filename: item.file?.filename ?? item.file?.file_name,
        }),
        ...(mimeType && { mime_type: mimeType }),
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
  return !getUnsupportedMultimodalRequirement(provider, effectiveParams, endpoint);
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
  return getUnsupportedMultimodalRequirement(provider, effectiveParams, endpoint);
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
