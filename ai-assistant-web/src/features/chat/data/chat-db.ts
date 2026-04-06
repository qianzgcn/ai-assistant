import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';

import { CHAT_DB_NAME, CHAT_DB_VERSION } from '@/features/chat/model/chat.constants';
import type {
  StoredConversation,
  StoredMessage,
} from '@/features/chat/model/chat.types';

interface ChatMetaRecord {
  key: string;
  value: string | null;
  updatedAt: string;
}

interface ChatDatabase extends DBSchema {
  conversations: {
    key: string;
    value: StoredConversation;
  };
  messages: {
    key: string;
    value: StoredMessage;
    indexes: {
      'by-conversationId': string;
      'by-createdAt': string;
    };
  };
  meta: {
    key: string;
    value: ChatMetaRecord;
  };
}

let databasePromise: Promise<IDBPDatabase<ChatDatabase>> | null = null;

export async function getChatDatabase() {
  if (!databasePromise) {
    databasePromise = openDB<ChatDatabase>(CHAT_DB_NAME, CHAT_DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('conversations')) {
          database.createObjectStore('conversations', { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains('messages')) {
          const store = database.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('by-conversationId', 'conversationId');
          store.createIndex('by-createdAt', 'createdAt');
        }

        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }

  return databasePromise;
}
