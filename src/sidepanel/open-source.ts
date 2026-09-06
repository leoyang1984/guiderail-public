import type { MessageSource } from '../storage/schema';
import { getChatGPTConversationId } from '../domain/conversation';

/** Retry only connection startup; a connected content script owns the bounded history search. */
export async function openSource(source: MessageSource): Promise<string> {
  if (getChatGPTConversationId(source.pageUrl) !== source.conversationId) throw new Error('Invalid source URL');
  const tabs = await chrome.tabs.query({});
  let tab = tabs.find(item => getChatGPTConversationId(item.url ?? '') === source.conversationId);
  if (!tab) tab = await chrome.tabs.create({ url: source.pageUrl, active: true });
  else {
    await chrome.tabs.update(tab.id!, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const result = await chrome.tabs.sendMessage(tab.id!, { kind: 'guiderail:locate', conversationId: source.conversationId, messageId: source.messageId, text: source.text });
      if (result?.found) return result.changed ? '已定位；页面内容与保存快照不同，下方仍保留收藏时的原文。' : '已定位并高亮原回复。';
      if (result?.reason === 'cancelled') return '定位已停止：你已操作页面或切换了对话。';
      if (result && !result.found) break;
    } catch { /* Page or content script may still be loading. */ }
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 600));
  }
  return '已尝试加载并查找旧消息，暂未找到原回复。对话可能过长、加载较慢，或回复已不在当前分支；可加载更多历史后重试。保存快照仍可在下方查看。更新扩展后请先刷新 ChatGPT 页面。';
}
