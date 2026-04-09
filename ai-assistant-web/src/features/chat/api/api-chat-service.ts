/**
 * API-based Chat Service
 * 
 * This service connects to the Python backend server instead of using mock data.
 * Implements the same ChatService interface for seamless switching.
 */

import type {
  ChatStreamEvent,
  Conversation,
  RegenerateAnswerRequest,
  SendMessageStreamRequest,
} from '@/features/chat/model/chat.types';

import type { ChatService } from './chat-service';

// Base URL for the API - can be configured via environment variable
const rawApiBaseUrl = (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL;
const API_BASE_URL = typeof rawApiBaseUrl === 'string' ? rawApiBaseUrl : '/api';

type ApiConversation = {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  status: Conversation['status'];
};

type ApiConversationListResponse = {
  conversations: ApiConversation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName} received from API`);
  }

  return value;
}

function readConversationStatus(value: unknown): Conversation['status'] {
  if (value === 'idle' || value === 'generating' || value === 'error') {
    return value;
  }

  throw new Error('Invalid conversation status received from API');
}

function parseConversation(value: unknown): ApiConversation {
  if (!isRecord(value)) {
    throw new Error('Invalid conversation received from API');
  }

  return {
    id: readString(value.id, 'conversation id'),
    title: readString(value.title, 'conversation title'),
    model: readString(value.model, 'conversation model'),
    created_at: readString(value.created_at, 'conversation created_at'),
    updated_at: readString(value.updated_at, 'conversation updated_at'),
    last_message_at: readString(value.last_message_at, 'conversation last_message_at'),
    status: readConversationStatus(value.status),
  };
}

function parseConversationListResponse(value: unknown): ApiConversationListResponse {
  if (!isRecord(value) || !Array.isArray(value.conversations)) {
    throw new Error('Invalid conversations response received from API');
  }

  return {
    conversations: value.conversations.map(parseConversation),
  };
}

function parseChatStreamEvent(value: unknown): ChatStreamEvent {
  if (!isRecord(value)) {
    throw new Error('Invalid stream event received from API');
  }

  const type = readString(value.type, 'stream event type');
  const conversationId = readString(value.conversationId, 'stream event conversationId');

  switch (type) {
    case 'message_start':
      return {
        type,
        conversationId,
        messageId: readString(value.messageId, 'stream event messageId'),
      };
    case 'message_delta':
      return {
        type,
        conversationId,
        messageId: readString(value.messageId, 'stream event messageId'),
        delta: readString(value.delta, 'stream event delta'),
      };
    case 'message_end':
      if (value.done !== true) {
        throw new Error('Invalid stream event done flag received from API');
      }

      return {
        type,
        conversationId,
        messageId: readString(value.messageId, 'stream event messageId'),
        content: readString(value.content, 'stream event content'),
        done: true,
      };
    case 'title_generated':
      return {
        type,
        conversationId,
        title: readString(value.title, 'stream event title'),
      };
    case 'error':
      return {
        type,
        conversationId,
        messageId: readString(value.messageId, 'stream event messageId'),
        error: readString(value.error, 'stream event error'),
      };
    default:
      throw new Error(`Unsupported stream event type received from API: ${type}`);
  }
}

export class ApiChatService implements ChatService {
  private abortControllers: Map<string, AbortController> = new Map();

  async listConversations(): Promise<Conversation[]> {
    const response = await fetch(`${API_BASE_URL}/conversations`);
    
    if (!response.ok) {
      throw new Error(`Failed to list conversations: ${response.statusText}`);
    }

    const data = parseConversationListResponse((await response.json()) as unknown);
    return data.conversations.map((conversation) => this.mapConversation(conversation));
  }

  async createConversation(conversation: Conversation): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: conversation.title,
        model: conversation.model,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`);
    }

    return this.mapConversation(parseConversation((await response.json()) as unknown));
  }

  async updateConversationMeta(conversation: Conversation): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversation.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: conversation.title,
        model: conversation.model,
        status: conversation.status,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.statusText}`);
    }

    return this.mapConversation(parseConversation((await response.json()) as unknown));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.statusText}`);
    }
  }

  async *sendMessageStream(
    request: SendMessageStreamRequest,
  ): AsyncGenerator<ChatStreamEvent, void, void> {
    // Create abort controller for this stream
    const controller = new AbortController();
    this.abortControllers.set(request.conversation.id, controller);

    try {
      // Prepare the request body
      const body = {
        conversation: {
          id: request.conversation.id,
          title: request.conversation.title,
          model: request.conversation.model,
          created_at: request.conversation.createdAt,
          updated_at: request.conversation.updatedAt,
          last_message_at: request.conversation.lastMessageAt,
          status: request.conversation.status,
        },
        history: request.history.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          status: msg.status,
        })),
        user_message: {
          id: request.userMessage.id,
          role: request.userMessage.role,
          content: request.userMessage.content,
          status: request.userMessage.status,
        },
        assistant_message_id: request.assistantMessageId,
        model: request.model,
        should_generate_title: request.shouldGenerateTitle,
      };

      // Make streaming request
      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = parseChatStreamEvent(JSON.parse(line.slice(6)) as unknown);
              yield data;

              // Check if stream ended
              if (data.type === 'message_end' || data.type === 'error') {
                return;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      this.abortControllers.delete(request.conversation.id);
    }
  }

  async *regenerateLastAnswer(
    request: RegenerateAnswerRequest,
  ): AsyncGenerator<ChatStreamEvent, void, void> {
    // Create abort controller for this stream
    const controller = new AbortController();
    this.abortControllers.set(request.conversation.id, controller);

    try {
      const body = {
        conversation: {
          id: request.conversation.id,
          title: request.conversation.title,
          model: request.conversation.model,
          created_at: request.conversation.createdAt,
          updated_at: request.conversation.updatedAt,
          last_message_at: request.conversation.lastMessageAt,
          status: request.conversation.status,
        },
        history: request.history.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          status: msg.status,
        })),
        base_user_message: {
          id: request.baseUserMessage.id,
          role: request.baseUserMessage.role,
          content: request.baseUserMessage.content,
          status: request.baseUserMessage.status,
        },
        assistant_message_id: request.assistantMessageId,
        model: request.model,
      };

      const response = await fetch(`${API_BASE_URL}/chat/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Regenerate request failed: ${response.statusText}`);
      }

      // Process SSE stream (same as sendMessageStream)
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = parseChatStreamEvent(JSON.parse(line.slice(6)) as unknown);
              yield data;

              if (data.type === 'message_end' || data.type === 'error') {
                return;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      this.abortControllers.delete(request.conversation.id);
    }
  }

  stopStreaming(conversationId: string): void {
    const controller = this.abortControllers.get(conversationId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(conversationId);
    }

    // Also notify server to stop
    fetch(`${API_BASE_URL}/chat/stop/${conversationId}`, {
      method: 'POST',
    }).catch(() => {
      // Ignore errors when stopping
    });
  }

  /**
   * Map API response to frontend Conversation type
   */
  private mapConversation(data: ApiConversation): Conversation {
    return {
      id: data.id,
      title: data.title,
      model: data.model,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastMessageAt: data.last_message_at,
      status: data.status,
    };
  }
}

export const apiChatService = new ApiChatService();
