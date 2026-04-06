import type {
  ChatStreamEvent,
  Conversation,
  RegenerateAnswerRequest,
  SendMessageStreamRequest,
} from '@/features/chat/model/chat.types';

export interface ChatService {
  listConversations(): Promise<Conversation[]>;
  createConversation(conversation: Conversation): Promise<Conversation>;
  updateConversationMeta(conversation: Conversation): Promise<Conversation>;
  deleteConversation(conversationId: string): Promise<void>;
  sendMessageStream(
    request: SendMessageStreamRequest,
  ): AsyncGenerator<ChatStreamEvent, void, void>;
  regenerateLastAnswer(
    request: RegenerateAnswerRequest,
  ): AsyncGenerator<ChatStreamEvent, void, void>;
  stopStreaming(conversationId: string): void;
}
