import { useState } from 'react';
import type { Capture, GuideRailStorage } from '../../storage/schema';
import type { RunCommand } from '../use-planner';
import { openSource } from '../open-source';
import { ReplyBody } from './ReplyBody';
import { TextForm } from './TextForm';
import { CopyReply } from './CopyReply';
import { ObsidianExport } from './ObsidianExport';
export function Replies({ data, conversationId, run, busy, initialReplyId = null, standalone = false }: { data: GuideRailStorage; conversationId: string | null; run: RunCommand; busy: boolean; initialReplyId?: string | null; standalone?: boolean }) {
  const [candidates, setCandidates] = useState<Capture[]>([]); const [finding, setFinding] = useState(false); const [findNotice, setFindNotice] = useState('');
  const [all, setAll] = useState(standalone); const [selected, setSelected] = useState<string | null>(initialReplyId);
  const [managing, setManaging] = useState(false); const [checked, setChecked] = useState<string[]>([]);
  const [openingReader, setOpeningReader] = useState(false);
  const [notice, setNotice] = useState(''); const [opening, setOpening] = useState(false); const [renaming, setRenaming] = useState(false);
  const sources = Object.values(data.sources).filter(source => all || !conversationId || source.conversationId === conversationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reply = sources.find(source => source.id === selected);
  const title = (source: typeof sources[number]) => source.title || source.text.split('\n').find(line => line.trim())?.slice(0, 80) || '收藏的回复';
  const chosen = sources.filter(source => checked.includes(source.id)).map(source => source.id);
  const remove = async (ids: string[]) => {
    if (ids.length && window.confirm(`删除这 ${ids.length} 条收藏？只删除 GuideRail 中的保存副本，不影响 ChatGPT 原对话。`)) {
      if (await run({ type: 'deleteReplies', ids })) { setChecked([]); setSelected(null); }
    }
  };
  return <section className="reply-library" aria-label="收藏的回复">
    {selected && !reply && <p role="status">这条收藏已不存在，可从列表中选择其他回复。</p>}
    {reply ? <>
      <div className="reading-tools"><button className="back-button" onClick={() => { setSelected(null); setNotice(''); setRenaming(false); }}>← 返回</button><button className="primary" disabled={opening} onClick={() => { setOpening(true); setNotice('正在定位，必要时会加载旧消息…'); void openSource(reply).then(setNotice).catch(() => setNotice('暂时无法打开原对话，仍可阅读下方保存的原文。')).finally(() => setOpening(false)); }}>定位到原回复</button><CopyReply key={reply.id} text={reply.text} />{!standalone && <button className="quiet-button" disabled={openingReader} onClick={() => {
        setOpeningReader(true);
        const url = new URL(chrome.runtime.getURL('src/sidepanel/index.html'));
        url.searchParams.set('view', 'reader'); url.searchParams.set('reply', reply.id);
        void chrome.tabs.create({ url: url.href }).catch(() => setNotice('暂时无法打开阅读页面，请重试。')).finally(() => setOpeningReader(false));
      }}>在新标签页阅读</button>}</div>
      {notice && <p role="status">{notice}</p>}
      <h2 className="reading-title">{title(reply)}</h2>
      <div className="reading-meta"><time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleDateString()} 收藏</time><span>ChatGPT</span></div>
      <details className="reply-more"><summary>更多操作</summary><button disabled={busy} onClick={() => setRenaming(!renaming)}>改收藏标题</button><button className="danger" disabled={busy} onClick={() => { void remove([reply.id]); }}>删除收藏</button></details>
      {renaming && <TextForm key={reply.id} label="收藏标题" initial={title(reply)} max={240} busy={busy} onCancel={() => setRenaming(false)} onSave={title => run({ type: 'renameReply', id: reply.id, title })} />}
    </> : <>
      <div className="section-heading"><h2>收藏的回复</h2><button className="quiet-button" onClick={() => { setManaging(!managing); setChecked([]); }}>{managing ? '完成' : '管理'}</button></div>
      <div className="collection-tabs" aria-label="收藏范围"><button aria-pressed={!all} onClick={() => { setAll(false); setChecked([]); }}>当前对话</button><button aria-pressed={all} onClick={() => { setAll(true); setChecked([]); }}>全部收藏 · {Object.keys(data.sources).length}</button></div>
      {conversationId && !managing && <details className="discovery"><summary>找当前对话中的长回复</summary>
        <p className="muted">列出已加载回复中较长的 5 条。更早内容需先在对话中加载。</p>
        <button disabled={finding} onClick={() => { setFinding(true); setCandidates([]); void (async () => {
          try { const window = await chrome.windows.getCurrent(); const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
            const result = await chrome.tabs.sendMessage(tab.id!, { kind: 'guiderail:longReplies' });
            const replies = (result?.replies ?? []) as Capture[]; setCandidates(replies.filter(item => item.conversationId === conversationId)); setFindNotice(replies.length ? '' : '未发现较长回复，请加载更多历史，或等待回复生成完成后重试。');
          } catch { setFindNotice('请刷新 ChatGPT 页面后重试。'); } finally { setFinding(false); }
        })(); }}>查找已加载的长回复</button>
        {findNotice && <p role="status">{findNotice}</p>}
        {candidates.map(item => <div className="source-card" key={item.messageId}><p>{item.text.slice(0, 160)}…</p><small>{item.text.length.toLocaleString()} 字符</small><div className="actions"><button disabled={busy} onClick={() => { void run({ type: 'saveReply', capture: item }).then(ok => { if (ok) { setFindNotice('已收藏，可在下方打开阅读。'); setCandidates(candidates.filter(other => other.messageId !== item.messageId)); } }); }}>收藏</button><button disabled={opening} onClick={() => { setOpening(true); void openSource({ ...item, id: '', createdAt: '', updatedAt: '' }).then(setFindNotice).catch(() => setFindNotice('暂时无法定位。')).finally(() => setOpening(false)); }}>定位</button></div></div>)}
      </details>}
      {managing && <div className="actions bulk-actions"><button onClick={() => setChecked(sources.map(source => source.id))}>全选</button><button className="danger" disabled={busy || !chosen.length} onClick={() => { void remove(chosen); }}>删除所选（{chosen.length}）</button></div>}
      {!sources.length && <p className="empty-state">{Object.keys(data.sources).length && !all ? '当前对话还没有收藏。其他对话的内容可在“全部收藏”中找到。' : '找到想留住的长计划，在回复末尾点击“☆ 收藏这条回复”。以后在这里阅读，或一键回到原位置。'}</p>}
      {sources.map(source => <div key={source.id} className="bookmark-row">{managing && <input type="checkbox" aria-label={`选择 ${title(source)}`} checked={checked.includes(source.id)} onChange={event => setChecked(event.target.checked ? [...checked, source.id] : checked.filter(id => id !== source.id))} />}<button className="bookmark-open" onClick={() => { setSelected(source.id); setNotice(''); }}><strong>{title(source)}</strong><span className="bookmark-excerpt">{source.text.split('\n').filter(line => line.trim()).slice(1).join(' ').replace(/```[a-z]*/gi, '').slice(0, 180)}</span><small>{new Date(source.createdAt).toLocaleDateString()}</small></button></div>)}
    </>}
    <ObsidianExport sources={reply ? [reply] : managing ? sources.filter(source => chosen.includes(source.id)) : sources} label={reply ? '导出这条回复' : managing ? `导出所选（${chosen.length}）` : `导出当前列表（${sources.length}）`} />
    {reply && <ReplyBody html={reply.html} text={reply.text} />}
  </section>;
}
