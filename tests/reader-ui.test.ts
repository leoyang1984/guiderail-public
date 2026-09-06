// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReplyBody } from '../src/sidepanel/components/ReplyBody';
import { CaptureStatus } from '../src/sidepanel/components/CaptureStatus';
import { Replies } from '../src/sidepanel/components/Replies';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage } from '../src/storage/schema';
import { loadDirectory, storeDirectory, writeNewFile } from '../src/export/directory';
vi.mock('../src/export/directory', () => ({ loadDirectory: vi.fn(async () => null), storeDirectory: vi.fn(async () => {}), writeNewFile: vi.fn(async () => 'written') }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function render(element: ReturnType<typeof createElement>) { await act(async () => root.render(element)); }
async function click(text: string) {
  const button = Array.from(host.querySelectorAll('button, summary')).find(el => el.textContent === text) as HTMLElement;
  expect(button, text).toBeTruthy(); await act(async () => button.click()); return button;
}
it.each([
  [{ available: true, streaming: false }, 'true'],
  [{ available: true, streaming: true }, 'false'],
  [{ available: false }, 'false'],
])('only marks a ready capture hint as routine: %s', async (result, routine) => {
  vi.stubGlobal('chrome', {
    windows: { getCurrent: async () => ({ id: 1 }) },
    tabs: { query: async () => [{ id: 1 }], sendMessage: async () => result },
  });
  await render(createElement(CaptureStatus));
  expect(host.querySelector('[role="status"]')?.getAttribute('data-routine')).toBe(routine);
});
it.each([
  ['<h2>标题</h2><p>正文</p>', 0],
  [' \n<!--注释--><div><h1><strong>标题</strong></h1><p>正文</p></div>', 0],
  ['<h2> 标题 </h2><h3>标题</h3>', 1],
  ['<p>前言</p><h2>标题</h2>', 1],
  ['<h2>标题补充</h2><p>正文</p>', 1],
  ['<blockquote><h2>标题</h2></blockquote>', 1],
  ['<pre>标题</pre><h2>标题</h2>', 1],
  ['<h2>标题</h2><h2>标题</h2>', 1],
])('only omits an identical opening heading: %s', async (html, remaining) => {
  const snapshot = { html, text: '标题\n正文' }; const before = JSON.stringify(snapshot);
  await render(createElement(ReplyBody, { ...snapshot, title: '标题' }));
  expect(host.querySelectorAll('h1,h2,h3')).toHaveLength(remaining);
  expect(JSON.stringify(snapshot)).toBe(before);
});
it('keeps the heading after renaming and preserves plain text', async () => {
  await render(createElement(ReplyBody, { html: '<h2>原标题</h2>', text: '原标题', title: '新标题' }));
  expect(host.querySelector('h2')?.textContent).toBe('原标题');
  await render(createElement(ReplyBody, { text: '标题\n正文', title: '标题' }));
  expect(host.textContent).toContain('标题\n正文');
});
it('continues to strip unsafe HTML and URLs', async () => {
  await render(createElement(ReplyBody, { html: '<h2>标题</h2><script>bad()</script><img src=x onerror=bad()><a href="javascript:bad()">链接</a>', text: '标题', title: '标题' }));
  expect(host.querySelector('script,img')).toBeNull(); expect(host.querySelector('a')?.hasAttribute('href')).toBe(false);
});
async function reader() {
  const data = applyCommand(emptyStorage(), { type: 'saveReply', capture: { role: 'assistant', messageId: 'msg', conversationId: 'chat', pageUrl: 'https://chatgpt.com/c/chat', text: '标题\n完整原文', html: '<h2>标题</h2><p>完整原文</p>' } });
  const id = Object.keys(data.sources)[0];
  const run = vi.fn(async () => true);
  const create = vi.fn(async () => ({ id: 2 }));
  vi.stubGlobal('chrome', { runtime: { getURL: () => 'chrome-extension://demo/src/sidepanel/index.html' }, tabs: { create } });
  await render(createElement(Replies, { data, conversationId: 'chat', run, busy: false, initialReplyId: id }));
  await click('更多操作');
  return { run, create, id, data };
}
it('uses native keyboard-focusable controls and Escape restores summary focus', async () => {
  await reader(); const details = host.querySelector('details.reply-more')!;
  expect(details.hasAttribute('open')).toBe(true);
  const summary = details.querySelector('summary')!;
  expect(host.querySelector('[tabindex]')).toBeNull();
  await click('改收藏标题');
  expect(document.activeElement).toBe(host.querySelector('input'));
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(details.hasAttribute('open')).toBe(false); expect(document.activeElement).toBe(summary);
  expect(host.querySelector('input')).toBeNull();
});
it('renames via form submission and returns focus to rename', async () => {
  const { run, id } = await reader(); await click('改收藏标题');
  const input = host.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '新标题');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(run).toHaveBeenCalledWith({ type: 'renameReply', id, title: '新标题' });
  expect(document.activeElement?.textContent).toBe('改收藏标题');
});
it('copies the complete snapshot and opens the correct standalone reply', async () => {
  const writeText = vi.fn(async () => {}); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { create, id } = await reader(); await click('复制全文');
  expect(writeText).toHaveBeenCalledWith('标题\n完整原文');
  await click('在新标签页阅读');
  expect(create).toHaveBeenCalledWith({ url: `chrome-extension://demo/src/sidepanel/index.html?view=reader&reply=${id}` });
});
it('reports standalone opening failure without leaving the action disabled', async () => {
  const { create } = await reader(); create.mockRejectedValueOnce(new Error('unavailable'));
  const button = await click('在新标签页阅读');
  expect(host.textContent).toContain('暂时无法打开阅读页面'); expect((button as HTMLButtonElement).disabled).toBe(false);
});
it('deletes only after confirmation', async () => {
  const { run, id } = await reader(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await click('删除收藏'); expect(run).not.toHaveBeenCalled();
  confirm.mockReturnValue(true); await click('删除收藏'); expect(run).toHaveBeenCalledWith({ type: 'deleteReplies', ids: [id] });
});
it('selects an export directory and exports the full original heading', async () => {
  const directory = { name: 'Notes', requestPermission: vi.fn(async () => 'granted') };
  Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: vi.fn(async () => directory) });
  await reader(); expect(loadDirectory).toHaveBeenCalled(); await click('导出到 Obsidian');
  await click('选择文件夹'); expect(storeDirectory).toHaveBeenCalledWith(directory);
  await click('导出这条回复');
  expect(directory.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  expect(writeNewFile).toHaveBeenCalled();
  expect(vi.mocked(writeNewFile).mock.calls[0][2]).toContain('标题');
  expect(host.textContent).toContain('已导出 1 条');
  delete (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
});
