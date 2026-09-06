import { useState } from 'react';
import type { GuideRailStorage, SourceLink } from '../../storage/schema';
import type { RunCommand } from '../use-planner';
import { openSource } from '../open-source';
export function SourceList({ stepId, data, busy, run }: { stepId: string; data: GuideRailStorage; busy: boolean; run: RunCommand }) {
  const [notice, setNotice] = useState(''); const [opening, setOpening] = useState(false);
  const links = Object.values(data.sourceLinks).filter(link => link.stepId === stepId);
  return <section aria-label="关联建议"><h3>关联建议 · {links.length}</h3>
    {!links.length && <p className="muted">在 ChatGPT 回复旁点击“收录到步骤”，把建议保存在这里。</p>}
    {notice && <p role="status">{notice}</p>}
    {links.map(link => { const source = data.sources[link.sourceId]; return <article key={link.id} className="source-card">
      <label>用途 <select disabled={busy} value={link.category} onChange={event => { void run({ type: 'categorizeSource', id: link.id, category: event.target.value as SourceLink['category'] }); }}>
        <option value="operation">操作</option><option value="troubleshooting">问题处理</option><option value="conclusion">结论</option>
      </select></label>
      <p className="muted">保存于 {new Date(source.updatedAt).toLocaleString()} · 对话 {source.conversationId.slice(0, 8)}</p>
      <details><summary>{source.text.slice(0, 90)}{source.text.length > 90 ? '…' : ''} · 查看保存原文</summary><pre className="command-block">{source.text}</pre></details>
      <div className="actions"><button disabled={opening} onClick={() => { setOpening(true); setNotice('正在打开并定位原回复…'); void openSource(source).then(setNotice).catch(() => setNotice('无法打开原对话，保存快照仍可查看。')).finally(() => setOpening(false)); }}>查看原文</button>
      <button disabled={busy} onClick={() => { if (window.confirm('解除此步骤的关联？其他步骤的引用不会受影响。')) void run({ type: 'unlinkSource', id: link.id }); }}>解除关联</button></div>
    </article>; })}
  </section>;
}
