import { apiFetch } from './client';

export const CHAT_ACTIONS = [
  'CHAT',
  'REWRITE',
  'EXPAND',
  'SHORTEN',
  'CHANGE_TONE',
  'TRANSLATE',
  'IDEAS',
] as const;

export type ChatAction = (typeof CHAT_ACTIONS)[number];

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  action: ChatAction;
  content: string;
  sourceContent?: string | null;
  target?: string | null;
  provider?: string | null;
  model?: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  projectId?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
  _count?: { messages: number };
}

export interface SendMessageInput {
  content: string;
  action?: ChatAction;
  sourceContent?: string;
  target?: string;
  assetId?: string;
}

export const listConversations = () =>
  apiFetch<{ items: Conversation[]; total: number }>('/chat/conversations');

export const getConversation = (id: string) =>
  apiFetch<Conversation>(`/chat/conversations/${id}`);

export const createConversation = (body: { title?: string; projectId?: string } = {}) =>
  apiFetch<Conversation>('/chat/conversations', { method: 'POST', body: JSON.stringify(body) });

export const renameConversation = (id: string, title: string) =>
  apiFetch<Conversation>(`/chat/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });

export const deleteConversation = (id: string) =>
  apiFetch<void>(`/chat/conversations/${id}`, { method: 'DELETE' });

export const sendMessage = (id: string, body: SendMessageInput) =>
  apiFetch<{ userMessage: ChatMessage; assistantMessage: ChatMessage; provider: string }>(
    `/chat/conversations/${id}/messages`,
    { method: 'POST', body: JSON.stringify(body) },
  );
