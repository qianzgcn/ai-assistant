import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatService } from '@/features/chat/api/chat-service';
import type {
  ChatSnapshot,
  Conversation,
  SendMessageStreamRequest,
} from '@/features/chat/model/chat.types';
import { createChatStore } from '@/features/chat/store/chat.store';
import { useChatUiStore } from '@/features/chat/store/chat-ui.store';

function createRepository(snapshot: ChatSnapshot = { conversations: [], messagesByConversation: {} }) {
  return {
    loadSnapshot: vi.fn(() => Promise.resolve(snapshot)),
    saveConversation: vi.fn(),
    saveMessages: vi.fn(),
    deleteMessages: vi.fn(),
    deleteConversation: vi.fn(),
  };
}

function createService(): ChatService {
  return {
    listConversations: vi.fn(() => Promise.resolve([])),
    createConversation: vi.fn((conversation: Conversation) => Promise.resolve(conversation)),
    updateConversationMeta: vi.fn((conversation: Conversation) => Promise.resolve(conversation)),
    deleteConversation: vi.fn(() => Promise.resolve()),
    async *sendMessageStream(request: SendMessageStreamRequest) {
      await Promise.resolve();
      yield {
        type: 'message_start',
        conversationId: request.conversation.id,
        messageId: request.assistantMessageId,
      } as const;
      yield {
        type: 'title_generated',
        conversationId: request.conversation.id,
        title: '测试标题',
      } as const;
      yield {
        type: 'message_delta',
        conversationId: request.conversation.id,
        messageId: request.assistantMessageId,
        delta: '你好',
      } as const;
      yield {
        type: 'message_end',
        conversationId: request.conversation.id,
        messageId: request.assistantMessageId,
        content: '你好，世界',
        done: true,
      } as const;
    },
    async *regenerateLastAnswer() {
      await Promise.resolve();
      yield* [];
      return;
    },
    stopStreaming: vi.fn(),
  };
}

function createBlockedStreamService() {
  const controllers = new Map<string, AbortController>();
  let notifyBlocked = () => {};
  const blocked = new Promise<void>((resolve) => {
    notifyBlocked = resolve;
  });

  return {
    service: {
      listConversations: vi.fn(() => Promise.resolve([])),
      createConversation: vi.fn((conversation: Conversation) => Promise.resolve(conversation)),
      updateConversationMeta: vi.fn((conversation: Conversation) => Promise.resolve(conversation)),
      deleteConversation: vi.fn(() => Promise.resolve()),
      async *sendMessageStream(request: SendMessageStreamRequest) {
        const controller = new AbortController();
        controllers.set(request.conversation.id, controller);

        try {
          yield {
            type: 'message_start',
            conversationId: request.conversation.id,
            messageId: request.assistantMessageId,
          } as const;

          await new Promise<void>((_resolve, reject) => {
            controller.signal.addEventListener(
              'abort',
              () => reject(new DOMException('stopped', 'AbortError')),
              { once: true },
            );
            notifyBlocked();
          });
        } finally {
          controllers.delete(request.conversation.id);
        }
      },
      async *regenerateLastAnswer() {
        await Promise.resolve();
        yield* [];
        return;
      },
      stopStreaming: vi.fn((conversationId: string) => {
        controllers.get(conversationId)?.abort();
      }),
    } satisfies ChatService,
    waitUntilBlocked: () => blocked,
  };
}

describe('chat-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatUiStore.setState({
      activeConversationId: null,
      searchQuery: '',
      editingConversationId: null,
      draftModel: 'mock-gpt-4.1',
    });
  });

  it('发送首条消息时会创建会话并写入助手回复', async () => {
    const repository = createRepository();
    const service = createService();
    const store = createChatStore({
      chatService: service,
      repository,
    });

    await store.getState().initialize();
    await store.getState().sendMessage('你好');

    const { conversations, messagesByConversation } = store.getState();
    const createdConversation = conversations[0];

    expect(createdConversation).toBeDefined();
    expect(createdConversation?.title).toBe('测试标题');

    if (!createdConversation) {
      throw new Error('会话未创建成功');
    }

    const messages = messagesByConversation[createdConversation.id];
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[1]?.content).toBe('你好，世界');
    expect(messages[1]?.status).toBe('completed');
  });

  it('删除生成中的会话后不会被流式回调重新写回', async () => {
    const repository = createRepository();
    const { service, waitUntilBlocked } = createBlockedStreamService();
    const store = createChatStore({
      chatService: service,
      repository,
    });

    await store.getState().initialize();
    const sendPromise = store.getState().sendMessage('你好');
    await waitUntilBlocked();

    const createdConversation = store.getState().conversations[0];
    expect(createdConversation?.status).toBe('generating');

    if (!createdConversation) {
      throw new Error('会话未创建成功');
    }

    await store.getState().deleteConversation(createdConversation.id);
    await sendPromise;

    expect(store.getState().conversations).toHaveLength(0);
    expect(store.getState().messagesByConversation[createdConversation.id]).toBeUndefined();
  });

  it('初始化时会修复残留的生成中状态', async () => {
    const snapshot: ChatSnapshot = {
      conversations: [
        {
          id: 'conversation-1',
          title: '测试会话',
          model: 'mock-gpt-4.1',
          createdAt: '2026-04-06T09:00:00.000Z',
          updatedAt: '2026-04-06T09:01:00.000Z',
          lastMessageAt: '2026-04-06T09:01:00.000Z',
          status: 'generating',
        },
      ],
      messagesByConversation: {
        'conversation-1': [
          {
            id: 'message-1',
            conversationId: 'conversation-1',
            role: 'assistant',
            content: '部分输出',
            createdAt: '2026-04-06T09:01:00.000Z',
            status: 'streaming',
          },
        ],
      },
    };
    const repository = createRepository(snapshot);
    const service = createService();
    const store = createChatStore({
      chatService: service,
      repository,
    });

    await store.getState().initialize();

    expect(store.getState().conversations[0]?.status).toBe('idle');
    expect(store.getState().messagesByConversation['conversation-1']?.[0]?.status).toBe('stopped');
    expect(repository.saveConversation).toHaveBeenCalledTimes(1);
    expect(repository.saveMessages).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'message-1',
        status: 'stopped',
      }),
    ]);
  });
});
