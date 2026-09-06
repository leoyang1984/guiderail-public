import { useState } from 'react';
import { parseOutline, PLANNING_PROMPT } from '../../domain/outline';
import type { RunCommand } from '../use-planner';
export function MarkdownImport({ planId, existingKeys, busy, run }: { planId: string; existingKeys: string[]; busy: boolean; run: RunCommand }) {
  const [open, setOpen] = useState(false); const [source, setSource] = useState(''); const [applyGoal, setApplyGoal] = useState(false); const [notice, setNotice] = useState('');
  let preview: ReturnType<typeof parseOutline> | undefined; let error = '';
  if (source.trim()) try { preview = parseOutline(source, existingKeys); } catch (cause) { error = (cause as Error).message; }
  return <div className="markdown-import">
    <button disabled={busy} onClick={() => { void navigator.clipboard.writeText(PLANNING_PROMPT).then(() => setNotice('已复制。粘贴给 ChatGPT 整理建议，再将结果导入。')).catch(() => setNotice('复制失败，可展开下方提示词手动复制。')); }}>复制整理计划提示词</button>
    <details><summary>查看整理提示词</summary><pre className="command-block">{PLANNING_PROMPT}</pre></details>{notice && <p role="status">{notice}</p>}
    {!open ? <button disabled={busy} onClick={() => setOpen(true)}>粘贴计划并预览</button> : <form onSubmit={event => {
      event.preventDefault(); if (preview && !error) void run({ type: 'importOutline', planId, source, applyGoal }).then(ok => { if (ok) { setOpen(false); setSource(''); setApplyGoal(false); } });
    }}>
      <label>粘贴步骤清单<textarea rows={7} maxLength={200000} disabled={busy} value={source} onChange={event => setSource(event.target.value)} placeholder={'总目标：完成 TTS 部署\n## 阶段一：环境准备\n1. 检查环境\n完成标准：显示版本号'} /></label>
      <p className="muted">标题 ## 表示阶段，编号、清单或 ### 标题表示步骤。请核对下方完整预览；确认后追加新阶段，保留已有步骤与进度。缩进子列表作为说明保留。</p>
      {error && <p role="alert" className="error">{error}</p>}
      {preview && <><p>将追加 {preview.phases.length} 个阶段、{preview.phases.reduce((sum, group) => sum + group.steps.length, 0)} 个步骤。</p>
        {(preview.goal || preview.completionCriteria) && <><p>总目标：{preview.goal || '未提供'}<br />目标完成条件：{preview.completionCriteria || '未提供'}</p><label><input type="checkbox" checked={applyGoal} disabled={busy} onChange={event => setApplyGoal(event.target.checked)} />使用以上目标信息替换计划中对应字段</label></>}
        {preview.unassigned && <details open><summary>以下内容仅保留在导入原文，不生成任务</summary><pre className="command-block">{preview.unassigned}</pre></details>}
        <div className="import-preview">{preview.phases.map((phase, index) => <section key={index}><h4>{phase.title}</h4><ol>{phase.steps.map(step => <li key={step.key}><details><summary>{step.status === 'done' ? '✓' : '○'} {step.key} · {step.title}</summary>{step.instructions && <p>操作说明：{step.instructions}</p>}{step.commands && <pre className="command-block">{step.commands}</pre>}{step.completionCriteria && <p>完成标准：{step.completionCriteria}</p>}</details></li>)}</ol></section>)}</div></>}
      <div className="actions"><button type="submit" disabled={busy || !preview || !!error}>确认追加阶段与步骤</button><button type="button" disabled={busy} onClick={() => { setOpen(false); setSource(''); setApplyGoal(false); }}>取消</button></div>
    </form>}
  </div>;
}
