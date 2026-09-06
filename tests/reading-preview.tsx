// Development-only UI harness. Not an extension build entry; no user storage is used.
import { createRoot } from 'react-dom/client';
import { App } from '../src/sidepanel/App';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage } from '../src/storage/schema';
import { createDispatcher } from '../src/storage/storage';
import '../src/sidepanel/style.css';
import '../src/sidepanel/reader.css';
function event() {
  const listeners = new Set<(...args: unknown[]) => void>();
  return { addListener: (listener: (...args: unknown[]) => void) => listeners.add(listener), removeListener: (listener: (...args: unknown[]) => void) => listeners.delete(listener), emit: (...args: unknown[]) => listeners.forEach(listener => listener(...args)) };
}
let data = emptyStorage();
for (const [i, [title, body]] of [
  ['让收藏成为下一次行动的起点', '有价值的回答值得留下，也值得再次打开。把当前的问题、尝试的过程和可以复用的结论放在一起。'],
  ['本地语音服务：从安装到第一次试听', '先确认运行环境，再启动服务。每一步都保留验证方法，让下一次排查更轻松。'],
  ['给自己的知识库留一点空白', '从真正需要的内容开始。无需一次整理完所有笔记，先留住眼下最有帮助的一条。'],
].entries()) {
  data = applyCommand(data, { type: 'saveReply', capture: { role: 'assistant', conversationId: 'preview', messageId: 'demo-'+i, pageUrl: 'https://chatgpt.com/c/preview', text: title+'\n'+body, html: '<h2>'+title+'</h2><p>'+body+'</p><h2>从一条笔记开始</h2><p>阅读时，先找出对自己有用的部分。需要更多上下文时，再回到原对话。</p><blockquote>收藏的意义，是让值得回看的内容更容易找到。</blockquote><h3>保留可以验证的步骤</h3><pre><code>python3 --version</code></pre><p>完成后，可以通过更多操作复制全文，或导出到自己的 Obsidian 笔记中。</p>' }});
}
data.sources = Object.fromEntries(Object.values(data.sources).map(source => [source.messageId, { ...source, id: source.messageId }]));
const changed = event();
const dispatch = createDispatcher({ read: async () => structuredClone(data), write: async next => { data = structuredClone(next); changed.emit({ guiderail: { newValue: data } }, 'local'); } });
const api = {
  windows: { getCurrent: async () => ({ id: 1 }), update: async () => ({}) },
  tabs: { sendMessage: async (_id: number, message: { kind: string }) => message.kind === 'guiderail:status' ? { available: true } : message.kind === 'guiderail:longReplies' ? { replies: [] } : { found: true }, update: async () => ({}), create: async ({ url }: { url: string }) => { window.open(url, '_blank', 'noopener'); return { id: 2 }; }, query: async () => [{ id: 1, url: 'https://chatgpt.com/c/preview' }], onActivated: event(), onUpdated: event(), onReplaced: event() },
  storage: { local: { get: async () => ({ guiderail: structuredClone(data) }) }, onChanged: changed },
  runtime: { getURL: () => new URL('/tests/reading-preview.html', location.origin).href, sendMessage: async (message: { command: Parameters<typeof dispatch>[0] }) => { await dispatch(message.command); return { ok: true }; } },
};
Object.defineProperty(globalThis, 'chrome', { configurable: true, value: api });
createRoot(document.getElementById('root')!).render(<App />);
