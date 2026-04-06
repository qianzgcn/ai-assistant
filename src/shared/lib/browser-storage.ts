const ACTIVE_CONVERSATION_KEY = 'ling-workspace-active-conversation';
const DRAFT_MODEL_KEY = 'ling-workspace-draft-model';

function readValue(key: string) {
  return window.localStorage.getItem(key);
}

function writeValue(key: string, value: string | null) {
  if (value === null) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
}

export function readActiveConversationId() {
  return readValue(ACTIVE_CONVERSATION_KEY);
}

export function writeActiveConversationId(conversationId: string | null) {
  writeValue(ACTIVE_CONVERSATION_KEY, conversationId);
}

export function readDraftModel() {
  return readValue(DRAFT_MODEL_KEY);
}

export function writeDraftModel(modelId: string) {
  writeValue(DRAFT_MODEL_KEY, modelId);
}
