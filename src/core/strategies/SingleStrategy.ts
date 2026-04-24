import type { Params } from '../../types/requestBody';
import type { StrategyResult } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';
import { retryRequest, retryRequestForStream } from '../RetryHandler';
import { transformRequest } from '../transformRequest';
import { createOpenAIStream, isOpenAICompatibleProvider } from '../transformOpenAIStream';
import { createAnthropicStream, isAnthropicProvider } from '../transformAnthropicStream';
import { createGoogleStream, isGoogleProvider } from '../transformGoogleStream';
import { createCohereStream, isCohereProvider } from '../transformCohereStream';
import { createBedrockStream, isBedrockProvider } from '../transformBedrockStream';
import { createBytezStream, isBytezProvider } from '../transformBytezStream';
import { generateAWSHeaders } from '../awsSigV4';

export class SingleStrategy {
  async execute(
    targets: Array<Record<string, unknown>>,
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] }
  ): Promise<StrategyResult> {
    if (targets.length === 0) {
      throw new Error('No targets provided');
    }

    const target = targets[0];
    const provider = (target['provider'] as string) || 'openai';
    const mergedParams = { ...params, ...(target['overrideParams'] as Record<string, unknown>) };

    const { body, headers, url, awsRegion, awsAccessKeyId, awsSecretAccessKey, awsSessionToken } = transformRequest(mergedParams, provider, target);

    let finalHeaders = headers;
    if (awsRegion && awsAccessKeyId && awsSecretAccessKey) {
      finalHeaders = await generateAWSHeaders(
        JSON.stringify(body),
        headers,
        url,
        'POST',
        awsRegion,
        awsAccessKeyId,
        awsSecretAccessKey,
        awsSessionToken
      );
    }

    const retryResult = await retryRequest(
      url,
      {
        method: 'POST',
        headers: finalHeaders,
        body: JSON.stringify(body),
      },
      retryConfig || (target['retry'] as { attempts?: number; onStatusCodes?: number[] })
    );

    return {
      success: retryResult.success,
      response: retryResult.response,
      provider,
      error: retryResult.error,
    };
  }

  async executeStream(
    targets: Array<Record<string, unknown>>,
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] }
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    if (targets.length === 0) {
      throw new Error('No targets provided');
    }

    const target = targets[0];
    const provider = (target['provider'] as string) || 'openai';
    const mergedParams = {
      ...params,
      stream: true,
      ...(target['overrideParams'] as Record<string, unknown>),
    };

    const { body, headers, url, awsRegion, awsAccessKeyId, awsSecretAccessKey, awsSessionToken } = transformRequest(mergedParams, provider, target);

    let finalHeaders = headers;
    if (awsRegion && awsAccessKeyId && awsSecretAccessKey) {
      finalHeaders = await generateAWSHeaders(
        JSON.stringify(body),
        headers,
        url,
        'POST',
        awsRegion,
        awsAccessKeyId,
        awsSecretAccessKey,
        awsSessionToken
      );
    }

    const retryResult = await retryRequestForStream(
      url,
      {
        method: 'POST',
        headers: finalHeaders,
        body: JSON.stringify(body),
      },
      retryConfig || (target['retry'] as { attempts?: number; onStatusCodes?: number[] })
    );

    if (!retryResult.success || !retryResult.response) {
      throw new Error(retryResult.error || 'Stream request failed');
    }

    if (isAnthropicProvider(provider)) {
      return createAnthropicStream(retryResult.response, provider);
    }

    if (isGoogleProvider(provider)) {
      return createGoogleStream(retryResult.response, provider);
    }

    if (isCohereProvider(provider)) {
      return createCohereStream(retryResult.response, provider);
    }

    if (isBedrockProvider(provider)) {
      return createBedrockStream(retryResult.response, provider);
    }

    if (isBytezProvider(provider)) {
      return createBytezStream(retryResult.response, provider);
    }

    if (isOpenAICompatibleProvider(provider)) {
      return createOpenAIStream(retryResult.response, provider);
    }

    return createOpenAIStream(retryResult.response, provider);
  }
}