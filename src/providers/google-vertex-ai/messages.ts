import { GOOGLE_VERTEX_AI } from '../../globals';
import type { MessagesResponse } from '../../types/messagesResponse';
import type { Options, Params } from '../../types/requestBody';
import { getMessagesConfig } from '../anthropic-base/messages';
import type { AnthropicErrorResponse } from '../anthropic/types';
import { AnthropicErrorResponseTransform } from '../anthropic/utils';
import type { ErrorResponse } from '../types';
import { generateInvalidProviderResponseError } from '../utils';

export const VertexAnthropicMessagesConfig = getMessagesConfig({
  extra: {
    anthropic_version: {
      param: 'anthropic_version',
      required: true,
      default: 'vertex-2023-10-16',
      transform: (params: Params, providerOptions?: Options) => {
        return (
          providerOptions?.anthropicVersion ||
          params['anthropic_version'] ||
          'vertex-2023-10-16'
        );
      },
    },
  },
  exclude: ['model'],
});

export const VertexAnthropicMessagesResponseTransform = (
  response: MessagesResponse | AnthropicErrorResponse,
  responseStatus: number
): MessagesResponse | ErrorResponse => {
  if (responseStatus !== 200) {
    const errorResposne = AnthropicErrorResponseTransform(
      response as AnthropicErrorResponse,
      GOOGLE_VERTEX_AI
    );
    if (errorResposne) return errorResposne;
  }

  if ('model' in response) return response;

  return generateInvalidProviderResponseError(response, GOOGLE_VERTEX_AI);
};
