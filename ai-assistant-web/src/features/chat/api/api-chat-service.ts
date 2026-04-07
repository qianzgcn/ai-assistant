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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiChatService implements ChatService {
  private abortControllers: Map<string, AbortController> = new Map();

  async listConversations(): Promise<Conversation[]> {
    const response = await fetch(`${API_BASE_URL}/conversations`);
    
    if (!response.ok) {
      throw new Error(`Failed to list conversations: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.conversations.map(this.mapConversation);
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
    
    return this.mapConversation(await response.json());
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
    
    return this.mapConversation(await response.json());
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
              const data = JSON.parse(line.slice(6));
              yield data as ChatStreamEvent;
              
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
              const data = JSON.parse(line.slice(6));
              yield data as ChatStreamEvent;
              
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
  private mapConversation(data: any): Conversation {
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
