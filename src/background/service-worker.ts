import { getChatGPTConversationId, isChatGPTUrl } from '../domain/conversation';
function configureSidePanel() {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error('Could not configure GuideRail side panel.', error));
}

chrome.runtime.onInstalled.addListener(configureSidePanel);
chrome.runtime.onStartup.addListener(configureSidePanel);
configureSidePanel();

import { ChromeStorageRepository, createDispatcher } from '../storage/storage';
const repository = new ChromeStorageRepository();
const dispatch = createDispatcher(repository);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.kind === 'guiderail:captureContext' && sender.tab && getChatGPTConversationId(sender.url ?? '')) {
    void repository.read().then(data => respond({ ok: true, data })).catch(() => respond({ ok: false })); return true;
  }
  if (message?.kind !== 'guiderail:command') return;
  const run = async () => {
    if (sender.tab) {
      if (sender.tab.id === undefined || sender.frameId !== 0 || !isChatGPTUrl(sender.url ?? '') || !['captureMessage', 'saveReply'].includes(message.command?.type)) {
        respond({ ok: false, error: 'invalid-source' }); return;
      }
      // Read the current tab URL: an SPA can change conversations without replacing its document.
      const tab = await chrome.tabs.get(sender.tab.id);
      const conversationId = getChatGPTConversationId(tab.url ?? '');
      if (!conversationId || conversationId !== message.command.capture?.conversationId) {
        respond({ ok: false, error: 'conversation-changed' }); return;
      }
    }
    await dispatch(message.command);
    respond({ ok: true });
  };
  void run().catch((error: unknown) => {
    console.error('Could not save GuideRail changes.', error);
    respond({ ok: false, error: 'save-failed' });
  });
  return true;
});
