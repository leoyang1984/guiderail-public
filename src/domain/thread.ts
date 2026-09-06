import { getChatGPTConversationId } from './conversation';
import type { Thread } from '../storage/schema';

export function threadLink(pageUrl?: string): { pageUrl?: string; conversationId?: string } {
  if (pageUrl === undefined || pageUrl === '') return {};
  if (typeof pageUrl !== 'string' || pageUrl.length > 4096) throw new Error('Invalid conversation URL');
  const url = pageUrl.trim();
  if (!url) return {};
  const conversationId = getChatGPTConversationId(url);
  if (!conversationId) throw new Error('Invalid conversation URL');
  return { pageUrl: url, conversationId };
}

export function getThreadUrl(thread: Pick<Thread, 'pageUrl' | 'conversationId'>): string | null {
  if (thread.pageUrl) {
    const id = getChatGPTConversationId(thread.pageUrl);
    return id && (!thread.conversationId || id === thread.conversationId) ? thread.pageUrl : null;
  }
  if (!thread.conversationId || !/^[a-zA-Z0-9_-]+$/.test(thread.conversationId)) return null;
  return `https://chatgpt.com/c/${thread.conversationId}`;
}
