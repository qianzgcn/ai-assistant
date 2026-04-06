import { CHAT_SCHEMA_VERSION } from '@/features/chat/model/chat.constants';
import type {
  ChatMessage,
  Conversation,
  StoredConversation,
  StoredMessage,
} from '@/features/chat/model/chat.types';

export function toStoredConversation(conversation: Conversation): StoredConversation {
  return {
    ...conversation,
    schemaVersion: CHAT_SCHEMA_VERSION,
  };
}

export function toStoredMessage(message: ChatMessage): StoredMessage {
  return {
    ...message,
    schemaVersion: CHAT_SCHEMA_VERSION,
  };
}

export function toConversation(record: StoredConversation): Conversation {
  return {
    id: record.id,
    title: record.title,
    model: record.model,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastMessageAt: record.lastMessageAt,
    status: record.status,
  };
}

export function toChatMessage(record: StoredMessage): ChatMessage {
  return {
    id: record.id,
    conversationId: record.conversationId,
    role: record.role,
    content: record.content,
    createdAt: record.createdAt,
    status: record.status,
    error: record.error,
  };
}
