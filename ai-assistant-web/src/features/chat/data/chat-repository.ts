import { getChatDatabase } from '@/features/chat/data/chat-db';
import { toChatMessage, toConversation, toStoredConversation, toStoredMessage } from '@/features/chat/model/chat.mappers';
import type { ChatMessage, ChatSnapshot, Conversation } from '@/features/chat/model/chat.types';

export class ChatRepository {
  async loadSnapshot(): Promise<ChatSnapshot> {
    const database = await getChatDatabase();
    const [conversationRecords, messageRecords] = await Promise.all([
      database.getAll('conversations'),
      database.getAll('messages'),
    ]);

    const conversations = conversationRecords
      .map(toConversation)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    const messagesByConversation = messageRecords
      .map(toChatMessage)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .reduce<Record<string, ChatMessage[]>>((result, message) => {
        const bucket = result[message.conversationId] ?? [];
        bucket.push(message);
        result[message.conversationId] = bucket;
        return result;
      }, {});

    return {
      conversations,
      messagesByConversation,
    };
  }

  async saveConversation(conversation: Conversation) {
    const database = await getChatDatabase();
    await database.put('conversations', toStoredConversation(conversation));
  }

  async saveMessages(messages: ChatMessage[]) {
    if (messages.length === 0) {
      return;
    }

    const database = await getChatDatabase();
    const transaction = database.transaction('messages', 'readwrite');

    await Promise.all(messages.map((message) => transaction.store.put(toStoredMessage(message))));
    await transaction.done;
  }

  async deleteMessages(messageIds: string[]) {
    if (messageIds.length === 0) {
      return;
    }

    const database = await getChatDatabase();
    const transaction = database.transaction('messages', 'readwrite');

    await Promise.all(messageIds.map((messageId) => transaction.store.delete(messageId)));
    await transaction.done;
  }

  async deleteConversation(conversationId: string) {
    const database = await getChatDatabase();
    const transaction = database.transaction(['conversations', 'messages'], 'readwrite');

    await transaction.objectStore('conversations').delete(conversationId);

    const messageIndex = transaction.objectStore('messages').index('by-conversationId');
    let cursor = await messageIndex.openCursor(conversationId);

    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    await transaction.done;
  }
}

export const chatRepository = new ChatRepository();
