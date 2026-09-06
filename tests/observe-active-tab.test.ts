import { afterEach, expect, it, vi } from 'vitest';
import { observeActiveTab } from '../src/sidepanel/observe-active-tab';

function event() { return { addListener: vi.fn(), removeListener: vi.fn() }; }
function setup() {
  const api = {
    windows: { getCurrent: vi.fn().mockResolvedValue({ id: 7 }) },
    tabs: {
      query: vi.fn().mockResolvedValue([{ url: 'https://chatgpt.com/c/first' }]),
      onActivated: event(), onUpdated: event(), onReplaced: event(),
    },
  };
  vi.stubGlobal('chrome', api);
  return api;
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('loads the panel window, follows tab and SPA URL changes, ignores other windows', async () => {
  const api = setup();
  const changed = vi.fn();
  const dispose = observeActiveTab(changed);
  await flush();
  expect(api.tabs.query).toHaveBeenCalledWith({ active: true, windowId: 7 });
  expect(changed).toHaveBeenLastCalledWith({ url: 'https://chatgpt.com/c/first', error: false });
  const activated = api.tabs.onActivated.addListener.mock.calls[0][0];
  activated({ windowId: 8 });
  expect(api.tabs.query).toHaveBeenCalledTimes(1);
  api.tabs.query.mockResolvedValue([{ url: 'https://chatgpt.com/c/second' }]);
  activated({ windowId: 7 });
  await flush();
  expect(changed).toHaveBeenLastCalledWith({ url: 'https://chatgpt.com/c/second', error: false });
  api.tabs.query.mockResolvedValue([{ url: 'https://chatgpt.com/' }]);
  api.tabs.onUpdated.addListener.mock.calls[0][0](1, { url: 'https://chatgpt.com/' }, { active: true, windowId: 7 });
  await flush();
  expect(changed).toHaveBeenLastCalledWith({ url: 'https://chatgpt.com/', error: false });
  dispose();
  expect(api.tabs.onActivated.removeListener).toHaveBeenCalledWith(activated);
});

it('discards stale queries and suppresses updates after unmount', async () => {
  const api = setup();
  const changed = vi.fn();
  let resolveOld!: (value: { url: string }[]) => void;
  api.tabs.query.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  const dispose = observeActiveTab(changed);
  await flush();
  api.tabs.onActivated.addListener.mock.calls[0][0]({ windowId: 7 });
  await flush();
  resolveOld([{ url: 'https://chatgpt.com/c/stale' }]);
  await flush();
  expect(changed).toHaveBeenCalledTimes(1);
  dispose();
  await flush();
  expect(changed).toHaveBeenCalledTimes(1);
});

it('reports API errors without throwing into the UI', async () => {
  const api = setup();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  api.tabs.query.mockRejectedValue(new Error('unavailable'));
  const changed = vi.fn();
  const dispose = observeActiveTab(changed);
  await flush();
  expect(changed).toHaveBeenCalledWith({ url: '', error: true });
  dispose();
});
