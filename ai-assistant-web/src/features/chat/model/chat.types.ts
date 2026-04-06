export type ConversationStatus = 'idle' | 'generating' | 'error';

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'stopped' | 'error';

export interface Conversation {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  status: ConversationStatus;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status: MessageStatus;
  error?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface ConversationGroup {
  label: string;
  items: Conversation[];
}

export interface ChatSnapshot {
  conversations: Conversation[];
  messagesByConversation: Record<string, ChatMessage[]>;
}

export interface StoredConversation extends Conversation {
  schemaVersion: number;
}

export interface StoredMessage extends ChatMessage {
  schemaVersion: number;
}

export interface SendMessageStreamRequest {
  conversation: Conversation;
  history: ChatMessage[];
  userMessage: ChatMessage;
  assistantMessageId: string;
  model: string;
  shouldGenerateTitle: boolean;
}

export type RegenerateAnswerRequest = Omit<SendMessageStreamRequest, 'userMessage'> & {
  baseUserMessage: ChatMessage;
};

export type ChatStreamEvent =
  | {
      type: 'message_start';
      conversationId: string;
      messageId: string;
    }
  | {
      type: 'message_delta';
      conversationId: string;
      messageId: string;
      delta: string;
    }
  | {
      type: 'message_end';
      conversationId: string;
      messageId: string;
      content: string;
      done: true;
    }
  | {
      type: 'title_generated';
      conversationId: string;
      title: string;
    }
  | {
      type: 'error';
      conversationId: string;
      messageId: string;
      error: string;
    };
