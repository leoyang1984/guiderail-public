import { useState } from 'react';
import type { GuideRailStorage, Plan } from '../../storage/schema';
import type { RunCommand } from '../use-planner';
import { TextForm } from './TextForm';
export function PhaseControls({ plan, data, run, busy }: { plan: Plan; data: GuideRailStorage; run: RunCommand; busy: boolean }) {
  const [adding, setAdding] = useState(false); const [renaming, setRenaming] = useState<string | null>(null);
  return <details className="phase-controls"><summary>管理阶段</summary>
    {plan.phaseIds.map((id, index) => <div key={id} className="phase-management"><strong>{data.phases[id].title}</strong>
      <div className="actions"><button disabled={busy || index === 0} aria-label={`上移阶段 ${data.phases[id].title}`} onClick={() => { void run({ type: 'movePhase', id, direction: -1 }); }}>↑</button><button disabled={busy || index === plan.phaseIds.length - 1} aria-label={`下移阶段 ${data.phases[id].title}`} onClick={() => { void run({ type: 'movePhase', id, direction: 1 }); }}>↓</button>
      <button disabled={busy} onClick={() => setRenaming(id)}>改阶段名</button><button disabled={busy || plan.phaseIds.length === 1 || plan.stepIds.some(key => data.steps[key].phaseId === id)} onClick={() => { void run({ type: 'deletePhase', id }); }}>删除空阶段</button></div>
      {renaming === id && <TextForm label="阶段名称" initial={data.phases[id].title} max={180} busy={busy} onCancel={() => setRenaming(null)} onSave={title => run({ type: 'renamePhase', id, title })} />}
    </div>)}
    {!adding ? <button disabled={busy} onClick={() => setAdding(true)}>＋ 添加阶段</button> : <TextForm label="新阶段名称" max={180} busy={busy} onCancel={() => setAdding(false)} onSave={title => run({ type: 'createPhase', planId: plan.id, title })} />}
  </details>;
}
export function GoalEditor({ plan, run, busy }: { plan: Plan; run: RunCommand; busy: boolean }) {
  const [editing, setEditing] = useState(false); const [goal, setGoal] = useState(''); const [criteria, setCriteria] = useState('');
  return <section className="plan-goal"><p><strong>总目标：</strong>{plan.goal || '尚未填写'}</p>
    <details><summary>目标完成条件</summary><p>{plan.completionCriteria || '尚未填写'}</p></details>
    <button disabled={busy} onClick={() => { setGoal(plan.goal ?? ''); setCriteria(plan.completionCriteria ?? ''); setEditing(!editing); }}>编辑目标</button>
    {editing && <form onSubmit={event => { event.preventDefault(); void run({ type: 'editGoal', planId: plan.id, goal, completionCriteria: criteria }).then(ok => { if (ok) setEditing(false); }); }}>
      <label>总目标<textarea required maxLength={10000} value={goal} disabled={busy} onChange={event => setGoal(event.target.value)} /></label>
      <label>目标完成条件<textarea maxLength={10000} value={criteria} disabled={busy} onChange={event => setCriteria(event.target.value)} /></label>
      <button disabled={busy}>保存目标</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>取消</button>
    </form>}
  </section>;
}
