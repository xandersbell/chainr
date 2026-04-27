import type { ContentType, Message } from '../types/requestBody';

export function getMessageContentBlocks(message: Message): ContentType[] | undefined {
  const content = message.content_blocks ?? message.content;
  return Array.isArray(content) ? content : undefined;
}
