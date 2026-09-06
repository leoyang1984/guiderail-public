import { useState } from 'react';
import type { GuideRailStorage, Step, Thread } from '../../storage/schema';
import type { RunCommand } from '../use-planner';
import { getThreadUrl } from '../../domain/thread';
import { openThreadConversation } from '../open-conversation';
import { ThreadForm } from './ThreadForm';

export function ThreadList({ step, data, busy, run, pageUrl }: {
  step: Step; data: GuideRailStorage; busy: boolean; run: RunCommand; pageUrl?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const threads = step.threadIds.map(id => data.threads[id]).filter((thread): thread is Thread => !!thread);
  async function open(thread: Thread) {
    setOpening(true); setError('');
    try { await openThreadConversation(thread); }
    catch (cause) { console.error('Could not open issue conversation.', cause); setError('无法打开关联对话，请重试。'); }
    finally { setOpening(false); }
  }
  return <section className="issues" aria-label="步骤问题">
    <div className="section-heading"><h3>问题</h3><span className="muted">{threads.filter(thread => !thread.resolved).length} 项未解决</span></div>
    {error && <p role="alert" className="error">{error}</p>}
    {!threads.length && <p className="muted">此步骤还没有问题记录。</p>}
    <ul className="thread-list">{threads.map(thread => <li key={thread.id}>
      <div className="thread-heading"><span className={thread.resolved ? 'resolved' : 'muted'}>{thread.resolved ? '✓ 已解决' : '○ 未解决'}</span><h4>{thread.title}</h4></div>
      {editing === thread.id ? <ThreadForm thread={thread} busy={busy} onCancel={() => setEditing(null)} onSave={values => run({ type: 'editThread', id: thread.id, ...values })} /> : <>
        {thread.description && <p className="notes">{thread.description}</p>}
        <div className="actions">
          <button disabled={busy} onClick={() => { void run({ type: 'resolveThread', id: thread.id, resolved: !thread.resolved }); }}>{thread.resolved ? '重新打开问题' : '标记已解决'}</button>
          {getThreadUrl(thread) && <button disabled={opening} onClick={() => { void open(thread); }}>打开对话 ↗</button>}
          <button disabled={busy || adding || editing !== null} onClick={() => setEditing(thread.id)}>编辑</button>
          <button className="danger" disabled={busy} onClick={() => {
            if (window.confirm(`删除问题「${thread.title}」？此操作无法撤销。`)) void run({ type: 'deleteThread', id: thread.id });
          }}>删除</button>
        </div>
        {!getThreadUrl(thread) && <p className="muted">未关联对话</p>}
      </>}
    </li>)}</ul>
    {adding ? <ThreadForm defaultUrl={pageUrl} busy={busy} onCancel={() => setAdding(false)} onSave={values => run({ type: 'createThread', stepId: step.id, ...values })} /> : <button disabled={busy || editing !== null} onClick={() => setAdding(true)}>＋ 添加问题</button>}
  </section>;
}
