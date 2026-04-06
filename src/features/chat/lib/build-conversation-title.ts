import { DEFAULT_CONVERSATION_TITLE } from '@/features/chat/model/chat.constants';

const TITLE_MAX_LENGTH = 22;

export function buildConversationTitle(input: string): string {
  const normalized = input
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  if (normalized.length <= TITLE_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, TITLE_MAX_LENGTH).trim()}...`;
}
