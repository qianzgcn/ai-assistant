import { create } from 'zustand';

import type { ChatService } from '@/features/chat/api/chat-service';
import { mockChatService } from '@/features/chat/api/mock-chat-service';
import { apiChatService } from '@/features/chat/api/api-chat-service';
import { chatRepository } from '@/features/chat/data/chat-repository';
import {
  DEFAULT_CONVERSATION_TITLE,
  DEFAULT_MODEL_ID,
} from '@/features/chat/model/chat.constants';
import type { ChatMessage, Conversation } from '@/features/chat/model/chat.types';
import { useChatUiStore } from '@/features/chat/store/chat-ui.store';

function currentTime() {
  return new Date().toISOString();
}

function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function upsertConversation(conversations: Conversation[], conversation: Conversation) {
  return sortConversations([...conversations.filter((item) => item.id !== conversation.id), conversation]);
}

function createConversationRecord(model: string): Conversation {
  const timestamp = currentTime();

  return {
    id: crypto.randomUUID(),
    title: DEFAULT_CONVERSATION_TITLE,
    model,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessageAt: timestamp,
    status: 'idle',
  };
}

function createMessage(
  conversationId: string,
  role: ChatMessage['role'],
  content: string,
  status: ChatMessage['status'],
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    createdAt: currentTime(),
    status,
  };
}

function replaceMessage(
  messages: ChatMessage[],
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
) {
  return messages.map((message) => (message.id === messageId ? updater(message) : message));
}

interface ChatState {
  initialized: boolean;
  conversations: Conversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
  initialize: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  updateConversationModel: (conversationId: string | null, modelId: string) => Promise<void>;
  regenerateLastAnswer: (conversationId: string) => Promise<void>;
  stopStreaming: (conversationId: string) => void;
}

interface ChatStoreDependencies {
  chatService: ChatService;
  repository: {
    loadSnapshot: () => Promise<{
      conversations: Conversation[];
      messagesByConversation: Record<string, ChatMessage[]>;
    }>;
    saveConversation: (conversation: Conversation) => Promise<void>;
    saveMessages: (messages: ChatMessage[]) => Promise<void>;
    deleteMessages: (messageIds: string[]) => Promise<void>;
  };
}

function setConversationState(
  target: Conversation,
  patch: Partial<Conversation>,
): Conversation {
  return {
    ...target,
    ...patch,
  };
}

function normalizeHydratedSnapshot(snapshot: {
  conversations: Conversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
}) {
  const repairedConversations: Conversation[] = [];
  const repairedMessages: ChatMessage[] = [];

  const conversations = snapshot.conversations.map((conversation) => {
    if (conversation.status !== 'generating') {
      return conversation;
    }

    const nextConversation = setConversationState(conversation, {
      status: 'idle',
    });
    repairedConversations.push(nextConversation);
    return nextConversation;
  });

  const messagesByConversation = Object.fromEntries(
    Object.entries(snapshot.messagesByConversation).map(([conversationId, messages]) => {
      const nextMessages = messages.map((message) => {
        if (message.status !== 'streaming') {
          return message;
        }

        const nextMessage: ChatMessage = {
          ...message,
          status: 'stopped',
          error: undefined,
        };
        repairedMessages.push(nextMessage);
        return nextMessage;
      });

      return [conversationId, nextMessages];
    }),
  );

  return {
    conversations,
    messagesByConversation,
    repairedConversations,
    repairedMessages,
  };
}

export function createChatStore({ chatService, repository }: ChatStoreDependencies) {
  return create<ChatState>((set, get) => ({
    initialized: false,
    conversations: [],
    messagesByConversation: {},
    initialize: async () => {
      if (get().initialized) {
        return;
      }

      useChatUiStore.getState().hydrate();
      const snapshot = normalizeHydratedSnapshot(await repository.loadSnapshot());
      const storedActiveId = useChatUiStore.getState().activeConversationId;
      const nextActiveId =
        storedActiveId && snapshot.conversations.some((item) => item.id === storedActiveId)
          ? storedActiveId
          : snapshot.conversations[0]?.id ?? null;

      useChatUiStore.getState().setActiveConversationId(nextActiveId);

      set({
        initialized: true,
        conversations: snapshot.conversations,
        messagesByConversation: snapshot.messagesByConversation,
      });

      await Promise.all([
        ...snapshot.repairedConversations.map((conversation) => repository.saveConversation(conversation)),
        snapshot.repairedMessages.length > 0
          ? repository.saveMessages(snapshot.repairedMessages)
          : Promise.resolve(),
      ]);
    },
    sendMessage: async (rawContent) => {
      const content = rawContent.trim();
      if (!content) {
        return;
      }

      const uiState = useChatUiStore.getState();
      const activeConversationId = uiState.activeConversationId;
      const draftModel = uiState.draftModel || DEFAULT_MODEL_ID;
      const existingConversation = get().conversations.find((item) => item.id === activeConversationId);

      if (existingConversation?.status === 'generating') {
        return;
      }

      const conversation = existingConversation ?? createConversationRecord(draftModel);
      const userMessage = createMessage(conversation.id, 'user', content, 'completed');
      const assistantMessage = createMessage(conversation.id, 'assistant', '', 'streaming');
      const shouldGenerateTitle = !existingConversation;
      const runtimeConversation = setConversationState(conversation, {
        model: existingConversation?.model ?? draftModel,
        status: 'generating',
        updatedAt: userMessage.createdAt,
        lastMessageAt: userMessage.createdAt,
      });
      const previousMessages = get().messagesByConversation[conversation.id] ?? [];
      const runtimeMessages = [...previousMessages, userMessage, assistantMessage];

      set((state) => ({
        conversations: upsertConversation(state.conversations, runtimeConversation),
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversation.id]: runtimeMessages,
        },
      }));

      uiState.setActiveConversationId(conversation.id);

      await Promise.all([
        existingConversation
          ? chatService.updateConversationMeta(runtimeConversation)
          : chatService.createConversation(runtimeConversation),
        repository.saveMessages([userMessage]),
      ]);

      try {
        for await (const event of chatService.sendMessageStream({
          conversation: runtimeConversation,
          history: runtimeMessages,
          userMessage,
          assistantMessageId: assistantMessage.id,
          model: runtimeConversation.model,
          shouldGenerateTitle,
        })) {
          if (event.type === 'title_generated') {
            const currentConversation = get().conversations.find((item) => item.id === event.conversationId);
            if (!currentConversation) {
              continue;
            }

            const nextConversation = setConversationState(currentConversation, {
              title: event.title || DEFAULT_CONVERSATION_TITLE,
            });

            set((state) => ({
              conversations: upsertConversation(state.conversations, nextConversation),
            }));

            void chatService.updateConversationMeta(nextConversation);
            continue;
          }

          if (event.type === 'message_delta') {
            if (!get().conversations.some((item) => item.id === event.conversationId)) {
              continue;
            }

            const currentMessages = get().messagesByConversation[event.conversationId] ?? [];
            if (!currentMessages.some((message) => message.id === event.messageId)) {
              continue;
            }

            const streamingMessages = replaceMessage(
              currentMessages,
              event.messageId,
              (message) => ({
                ...message,
                content: `${message.content}${event.delta}`,
              }),
            );

            set((state) => ({
              messagesByConversation: {
                ...state.messagesByConversation,
                [event.conversationId]: streamingMessages,
              },
            }));
            continue;
          }

          if (event.type === 'error') {
            const currentConversation = get().conversations.find((item) => item.id === event.conversationId);
            if (!currentConversation) {
              return;
            }

            const currentMessages = get().messagesByConversation[event.conversationId] ?? [];
            if (!currentMessages.some((message) => message.id === event.messageId)) {
              return;
            }

            const failedConversation = setConversationState(currentConversation, {
              status: 'error',
              updatedAt: currentTime(),
            });
            const failedMessages = replaceMessage(
              currentMessages,
              event.messageId,
              (message): ChatMessage => ({
                ...message,
                status: 'error',
                error: event.error,
              }),
            );
            const failedMessage = failedMessages.find((message) => message.id === event.messageId);

            set((state) => ({
              conversations: upsertConversation(state.conversations, failedConversation),
              messagesByConversation: {
                ...state.messagesByConversation,
                [event.conversationId]: failedMessages,
              },
            }));

            await Promise.all([
              chatService.updateConversationMeta(failedConversation),
              failedMessage ? repository.saveMessages([failedMessage]) : Promise.resolve(),
            ]);
            return;
          }

          if (event.type === 'message_end') {
            const currentConversation = get().conversations.find((item) => item.id === event.conversationId);
            if (!currentConversation) {
              continue;
            }

            const currentMessages = get().messagesByConversation[event.conversationId] ?? [];
            if (!currentMessages.some((message) => message.id === event.messageId)) {
              continue;
            }

            const completedConversation = setConversationState(
              currentConversation,
              {
                status: 'idle',
                updatedAt: currentTime(),
                lastMessageAt: currentTime(),
              },
            );
            const completedMessages = replaceMessage(
              currentMessages,
              event.messageId,
              (message): ChatMessage => ({
                ...message,
                content: event.content,
                status: 'completed',
              }),
            );
            const completedMessage = completedMessages.find((message) => message.id === event.messageId);

            set((state) => ({
              conversations: upsertConversation(state.conversations, completedConversation),
              messagesByConversation: {
                ...state.messagesByConversation,
                [event.conversationId]: completedMessages,
              },
            }));

            await Promise.all([
              chatService.updateConversationMeta(completedConversation),
              completedMessage ? repository.saveMessages([completedMessage]) : Promise.resolve(),
            ]);
          }
        }
      } catch (error) {
        const stopped = error instanceof DOMException && error.name === 'AbortError';
        const currentConversation = get().conversations.find((item) => item.id === conversation.id);
        const currentMessages = get().messagesByConversation[conversation.id] ?? [];
        if (!currentConversation || !currentMessages.some((message) => message.id === assistantMessage.id)) {
          return;
        }

        const fallbackConversation = setConversationState(currentConversation, {
          status: stopped ? 'idle' : 'error',
          updatedAt: currentTime(),
        });
        const fallbackMessages = replaceMessage(
          currentMessages,
          assistantMessage.id,
          (message): ChatMessage => ({
            ...message,
            status: stopped ? 'stopped' : 'error',
            error: stopped ? undefined : error instanceof Error ? error.message : '生成失败，请稍后重试。',
          }),
        );
        const fallbackMessage = fallbackMessages.find((message) => message.id === assistantMessage.id);

        set((state) => ({
          conversations: upsertConversation(state.conversations, fallbackConversation),
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversation.id]: fallbackMessages,
          },
        }));

        await Promise.all([
          chatService.updateConversationMeta(fallbackConversation),
          fallbackMessage ? repository.saveMessages([fallbackMessage]) : Promise.resolve(),
        ]);
      }
    },
    renameConversation: async (conversationId, title) => {
      const targetConversation = get().conversations.find((item) => item.id === conversationId);
      if (!targetConversation) {
        return;
      }

      const nextConversation = setConversationState(targetConversation, {
        title: title.trim() || DEFAULT_CONVERSATION_TITLE,
        updatedAt: currentTime(),
      });

      set((state) => ({
        conversations: upsertConversation(state.conversations, nextConversation),
      }));

      await chatService.updateConversationMeta(nextConversation);
    },
    deleteConversation: async (conversationId) => {
      chatService.stopStreaming(conversationId);
      const nextConversations = get().conversations.filter((item) => item.id !== conversationId);
      const nextMessages = { ...get().messagesByConversation };
      delete nextMessages[conversationId];

      set({
        conversations: nextConversations,
        messagesByConversation: nextMessages,
      });

      if (useChatUiStore.getState().activeConversationId === conversationId) {
        useChatUiStore.getState().setActiveConversationId(nextConversations[0]?.id ?? null);
      }

      await chatService.deleteConversation(conversationId);
    },
    updateConversationModel: async (conversationId, modelId) => {
      if (!conversationId) {
        useChatUiStore.getState().setDraftModel(modelId);
        return;
      }

      const targetConversation = get().conversations.find((item) => item.id === conversationId);
      if (!targetConversation) {
        useChatUiStore.getState().setDraftModel(modelId);
        return;
      }

      const nextConversation = setConversationState(targetConversation, {
        model: modelId,
        updatedAt: currentTime(),
      });

      set((state) => ({
        conversations: upsertConversation(state.conversations, nextConversation),
      }));

      await chatService.updateConversationMeta(nextConversation);
    },
    regenerateLastAnswer: async (conversationId) => {
      const conversation = get().conversations.find((item) => item.id === conversationId);
      const messages = get().messagesByConversation[conversationId] ?? [];
      const lastUserIndex = [...messages]
        .map((message, index) => ({ message, index }))
        .filter((item) => item.message.role === 'user')
        .at(-1)?.index;

      if (!conversation || lastUserIndex === undefined) {
        return;
      }

      const baseUserMessage = messages[lastUserIndex];
      const removableMessages = messages.slice(lastUserIndex + 1);
      const assistantMessage = createMessage(conversationId, 'assistant', '', 'streaming');
      const nextConversation = setConversationState(conversation, {
        status: 'generating',
        updatedAt: currentTime(),
      });
      const nextMessages = [...messages.slice(0, lastUserIndex + 1), assistantMessage];

      set((state) => ({
        conversations: upsertConversation(state.conversations, nextConversation),
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: nextMessages,
        },
      }));

      await Promise.all([
        chatService.updateConversationMeta(nextConversation),
        repository.deleteMessages(removableMessages.map((message) => message.id)),
      ]);

      try {
        for await (const event of chatService.regenerateLastAnswer({
          conversation: nextConversation,
          history: nextMessages,
          baseUserMessage,
          assistantMessageId: assistantMessage.id,
          model: nextConversation.model,
          shouldGenerateTitle: false,
        })) {
          if (event.type === 'message_delta') {
            if (!get().conversations.some((item) => item.id === conversationId)) {
              continue;
            }

            const currentMessages = get().messagesByConversation[conversationId] ?? [];
            if (!currentMessages.some((message) => message.id === event.messageId)) {
              continue;
            }

            const streamingMessages = replaceMessage(
              currentMessages,
              event.messageId,
              (message) => ({
                ...message,
                content: `${message.content}${event.delta}`,
              }),
            );

            set((state) => ({
              messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: streamingMessages,
              },
            }));
          }

          if (event.type === 'error') {
            throw new Error(event.error);
          }

          if (event.type === 'message_end') {
            const currentConversation = get().conversations.find((item) => item.id === conversationId);
            if (!currentConversation) {
              continue;
            }

            const currentMessages = get().messagesByConversation[conversationId] ?? [];
            if (!currentMessages.some((message) => message.id === event.messageId)) {
              continue;
            }

            const completedConversation = setConversationState(currentConversation, {
              status: 'idle',
              updatedAt: currentTime(),
              lastMessageAt: currentTime(),
            });
            const completedMessages = replaceMessage(
              currentMessages,
              event.messageId,
              (message): ChatMessage => ({
                ...message,
                content: event.content,
                status: 'completed',
              }),
            );
            const completedMessage = completedMessages.find((message) => message.id === event.messageId);

            set((state) => ({
              conversations: upsertConversation(state.conversations, completedConversation),
              messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: completedMessages,
              },
            }));

            await Promise.all([
              chatService.updateConversationMeta(completedConversation),
              completedMessage ? repository.saveMessages([completedMessage]) : Promise.resolve(),
            ]);
          }
        }
      } catch (error) {
        const stopped = error instanceof DOMException && error.name === 'AbortError';
        const currentConversation = get().conversations.find((item) => item.id === conversationId);
        const currentMessages = get().messagesByConversation[conversationId] ?? [];
        if (!currentConversation || !currentMessages.some((message) => message.id === assistantMessage.id)) {
          return;
        }

        const fallbackConversation = setConversationState(currentConversation, {
          status: stopped ? 'idle' : 'error',
          updatedAt: currentTime(),
        });
        const fallbackMessages = replaceMessage(
          currentMessages,
          assistantMessage.id,
          (message): ChatMessage => ({
            ...message,
            status: stopped ? 'stopped' : 'error',
            error: stopped ? undefined : error instanceof Error ? error.message : '重新生成失败。',
          }),
        );
        const fallbackMessage = fallbackMessages.find((message) => message.id === assistantMessage.id);

        set((state) => ({
          conversations: upsertConversation(state.conversations, fallbackConversation),
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: fallbackMessages,
          },
        }));

        await Promise.all([
          chatService.updateConversationMeta(fallbackConversation),
          fallbackMessage ? repository.saveMessages([fallbackMessage]) : Promise.resolve(),
        ]);
      }
    },
    stopStreaming: (conversationId) => {
      chatService.stopStreaming(conversationId);
    },
  }));
}

// Select service based on environment
const getActiveChatService = (): ChatService => {
  if (import.meta.env.VITE_USE_MOCK_SERVICE === 'true') {
    console.log('[Store] Using mock chat service');
    return mockChatService;
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('[Store] Using API chat service:', import.meta.env.VITE_API_BASE_URL);
    return apiChatService;
  }
  console.log('[Store] Using mock chat service (default)');
  return mockChatService;
};

export const useChatStore = createChatStore({
  chatService: getActiveChatService(),
  repository: chatRepository,
});
