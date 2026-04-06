import { describe, expect, it } from 'vitest';

import { buildConversationTitle } from '@/features/chat/lib/build-conversation-title';

describe('buildConversationTitle', () => {
  it('会在内容较短时直接返回标题', () => {
    expect(buildConversationTitle('请帮我梳理需求')).toBe('请帮我梳理需求');
  });

  it('会在内容过长时自动截断', () => {
    expect(buildConversationTitle('这是一个特别长特别长特别长的标题，用来测试截断逻辑')).toBe(
      '这是一个特别长特别长特别长的标题，用来测试截...',
    );
  });
});
