import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { groupConversationsByRecency } from '@/features/chat/lib/group-conversations-by-recency';
import type { Conversation } from '@/features/chat/model/chat.types';

const baseConversation: Conversation = {
  id: '1',
  title: '测试',
  model: 'mock-gpt-4.1',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
  lastMessageAt: '2026-04-01T10:00:00.000Z',
  status: 'idle',
};

describe('groupConversationsByRecency', () => {
  it('会按今天、近 7 天、更早分组', () => {
    const groups = groupConversationsByRecency(
      [
        {
          ...baseConversation,
          id: 'today',
          updatedAt: '2026-04-06T02:00:00.000Z',
        },
        {
          ...baseConversation,
          id: 'week',
          updatedAt: '2026-04-03T02:00:00.000Z',
        },
        {
          ...baseConversation,
          id: 'old',
          updatedAt: '2026-03-20T02:00:00.000Z',
        },
      ],
      dayjs('2026-04-06T12:00:00.000Z'),
    );

    expect(groups.map((item) => item.label)).toEqual(['今天', '近 7 天', '更早']);
    expect(groups[0]?.items[0]?.id).toBe('today');
    expect(groups[1]?.items[0]?.id).toBe('week');
    expect(groups[2]?.items[0]?.id).toBe('old');
  });
});
