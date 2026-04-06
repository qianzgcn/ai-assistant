import { create } from 'zustand';

import { DEFAULT_MODEL_ID } from '@/features/chat/model/chat.constants';
import {
  readActiveConversationId,
  readDraftModel,
  writeActiveConversationId,
  writeDraftModel,
} from '@/shared/lib/browser-storage';

interface ChatUiState {
  activeConversationId: string | null;
  searchQuery: string;
  editingConversationId: string | null;
  draftModel: string;
  hydrate: () => void;
  setActiveConversationId: (conversationId: string | null) => void;
  setSearchQuery: (value: string) => void;
  setEditingConversationId: (conversationId: string | null) => void;
  setDraftModel: (modelId: string) => void;
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  activeConversationId: null,
  searchQuery: '',
  editingConversationId: null,
  draftModel: DEFAULT_MODEL_ID,
  hydrate: () => {
    set({
      activeConversationId: readActiveConversationId(),
      draftModel: readDraftModel() ?? DEFAULT_MODEL_ID,
    });
  },
  setActiveConversationId: (conversationId) => {
    writeActiveConversationId(conversationId);
    set({ activeConversationId: conversationId });
  },
  setSearchQuery: (value) => {
    set({ searchQuery: value });
  },
  setEditingConversationId: (conversationId) => {
    set({ editingConversationId: conversationId });
  },
  setDraftModel: (modelId) => {
    writeDraftModel(modelId);
    set({ draftModel: modelId });
  },
}));
