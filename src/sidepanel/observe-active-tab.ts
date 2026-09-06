export interface TabContext {
  url: string;
  error: boolean;
}

/** Observe the panel's own window; discard stale asynchronous query results. */
export function observeActiveTab(onChange: (context: TabContext) => void): () => void {
  let disposed = false;
  let revision = 0;
  let windowId: number | undefined;

  async function refresh() {
    const request = ++revision;
    try {
      if (windowId === undefined) windowId = (await chrome.windows.getCurrent()).id;
      if (disposed || request !== revision) return;
      if (windowId === undefined) throw new Error('Panel window unavailable');
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (!disposed && request === revision) onChange({ url: tab?.url ?? '', error: false });
    } catch (error) {
      if (!disposed && request === revision) {
        console.error('Could not detect conversation.', error);
        onChange({ url: '', error: true });
      }
    }
  }

  const activated = (info: chrome.tabs.TabActiveInfo) => {
    if (windowId === undefined || info.windowId === windowId) void refresh();
  };
  const updated = (_id: number, change: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (tab.active && (windowId === undefined || tab.windowId === windowId) && (change.url !== undefined || change.status === 'complete')) void refresh();
  };
  const replaced = () => { void refresh(); };
  chrome.tabs.onActivated.addListener(activated);
  chrome.tabs.onUpdated.addListener(updated);
  chrome.tabs.onReplaced.addListener(replaced);
  void refresh();
  return () => {
    disposed = true;
    revision++;
    chrome.tabs.onActivated.removeListener(activated);
    chrome.tabs.onUpdated.removeListener(updated);
    chrome.tabs.onReplaced.removeListener(replaced);
  };
}
