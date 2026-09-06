import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup(currentUrl = 'https://chatgpt.com/c/new-chat') {
  vi.resetModules();
  let listener: (message: unknown, sender: chrome.runtime.MessageSender, respond: (result: unknown) => void) => unknown;
  const set = vi.fn(async () => {});
  const getTab = vi.fn(async () => ({ url: currentUrl }));
  vi.stubGlobal('chrome', {
    runtime: { id: 'guiderail', onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() }, onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } },
    sidePanel: { setPanelBehavior: vi.fn(async () => {}) },
    tabs: { get: getTab },
    storage: { local: { get: vi.fn(async () => ({})), set } },
  });
  await import('../src/background/service-worker');
  const send = (url: string, conversationId = 'new-chat', frameId = 0) => new Promise(resolve => {
    listener({ kind: 'guiderail:command', command: { type: 'saveReply', capture: {
      conversationId, messageId: 'reply', role: 'assistant', pageUrl: `https://chatgpt.com/c/${conversationId}`, text: 'A saved reply',
    } } }, { id: 'guiderail', url, frameId, tab: { id: 7 } as chrome.tabs.Tab }, resolve);
  });
  return { send, set, getTab };
}

it.each(['https://chatgpt.com/', 'https://chatgpt.com/c/old-chat'])('saves after SPA navigation from %s using the current tab URL', async url => {
  const { send, set, getTab } = await setup();
  expect(await send(url)).toEqual({ ok: true });
  expect(getTab).toHaveBeenCalledWith(7);
  expect(set).toHaveBeenCalledOnce();
});

it('rejects a capture from a conversation that is no longer current', async () => {
  const { send, set } = await setup();
  expect(await send('https://chatgpt.com/c/old-chat', 'old-chat')).toEqual({ ok: false, error: 'conversation-changed' });
  expect(set).not.toHaveBeenCalled();
});

it.each(['https://example.com/c/new-chat', 'https://chatgpt.com/'])('rejects a tab without a current ChatGPT conversation: %s', async url => {
  const { send, set } = await setup(url);
  expect(await send('https://chatgpt.com/c/new-chat')).toEqual({ ok: false, error: 'conversation-changed' });
  expect(set).not.toHaveBeenCalled();
});

it('rejects foreign origins and child frames', async () => {
  const { send, set } = await setup();
  expect(await send('https://example.com/c/new-chat')).toEqual({ ok: false, error: 'invalid-source' });
  expect(await send('https://chatgpt.com/c/new-chat', 'new-chat', 1)).toEqual({ ok: false, error: 'invalid-source' });
  expect(set).not.toHaveBeenCalled();
});

it('reports storage failures without claiming the reply was saved', async () => {
  const { send, set } = await setup();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  set.mockRejectedValueOnce(new Error('Quota exceeded'));
  expect(await send('https://chatgpt.com/c/new-chat')).toEqual({ ok: false, error: 'save-failed' });
});
