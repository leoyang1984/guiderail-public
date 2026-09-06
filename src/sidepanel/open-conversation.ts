import { getThreadUrl } from '../domain/thread';
import type { Thread } from '../storage/schema';

export async function openThreadConversation(thread: Pick<Thread, 'pageUrl' | 'conversationId'>): Promise<void> {
  const url = getThreadUrl(thread);
  if (!url) throw new Error('Issue has no valid conversation');
  const { id: windowId } = await chrome.windows.getCurrent();
  if (windowId === undefined) throw new Error('Panel window unavailable');
  await chrome.tabs.create({ url, windowId, active: true });
}
