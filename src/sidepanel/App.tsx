import { useEffect, useState } from 'react';
import { CaptureStatus } from './components/CaptureStatus';
import { BackupControls } from './components/BackupControls';
import { Replies } from './components/Replies';
import { getChatGPTConversationId } from '../domain/conversation';
import { observeActiveTab, type TabContext } from './observe-active-tab';
import { usePlanner } from './use-planner';
export function App() {
  const [reader] = useState(() => { const params = new URLSearchParams(location.search); return { standalone: params.get('view') === 'reader', replyId: params.get('reply') }; });
  const [context, setContext] = useState<TabContext | null>(null);
  const available = typeof chrome !== 'undefined' && !!chrome.tabs && !!chrome.storage;
  const { data, error, busy, run } = usePlanner(available);
  useEffect(() => { if (available && !reader.standalone) return observeActiveTab(setContext); }, [available, reader.standalone]);
  const conversationId = getChatGPTConversationId(context?.url ?? '');
  return <main className="reader-app"><header className="app-header"><h1><span className="brand-mark" aria-hidden="true">G</span>GuideRail</h1><span>{busy ? '保存中…' : '留住值得回看的回复'}</span></header>
    {!available ? <p>请在 Chrome 扩展侧边栏中打开。</p> : reader.standalone ? null : conversationId ? <CaptureStatus key={conversationId} /> : <p className="muted">打开 ChatGPT 对话即可收藏回复；已有收藏仍可查看。</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {available && !data && !error && <p>正在读取收藏…</p>}
    {data && <><Replies key={conversationId ?? 'all'} data={data} conversationId={conversationId} run={run} busy={busy} initialReplyId={reader.standalone ? reader.replyId : null} standalone={reader.standalone} />
      <details className="data-settings"><summary>数据与备份</summary><BackupControls data={data} busy={busy} run={run} />
        {!!Object.keys(data.plans).length && <p className="muted">旧任务数据仍保存在备份中，已收录的回复直接显示在收藏里。</p>}
        <button className="danger" disabled={busy} onClick={() => { if (window.confirm('清空全部收藏及旧项目、阶段、步骤和问题？此操作不能撤销，ChatGPT 原对话不受影响。')) void run({ type: 'clearAll', expectedSource: JSON.stringify(data) }); }}>清空全部本地数据</button>
      </details></>}
    <footer>内容保存在本机。收藏不会修改 ChatGPT 原对话。</footer>
  </main>;
}
