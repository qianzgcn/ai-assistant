import dayjs from 'dayjs';

import type { Conversation, ConversationGroup } from '@/features/chat/model/chat.types';

export function groupConversationsByRecency(
  conversations: Conversation[],
  now = dayjs(),
): ConversationGroup[] {
  const groups = new Map<string, Conversation[]>();

  conversations.forEach((conversation) => {
    const updatedAt = dayjs(conversation.updatedAt);
    const diffDays = now.startOf('day').diff(updatedAt.startOf('day'), 'day');
    const label = diffDays <= 0 ? '今天' : diffDays <= 6 ? '近 7 天' : '更早';
    const bucket = groups.get(label) ?? [];
    bucket.push(conversation);
    groups.set(label, bucket);
  });

  return ['今天', '近 7 天', '更早']
    .map((label) => ({
      label,
      items: groups.get(label) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}
