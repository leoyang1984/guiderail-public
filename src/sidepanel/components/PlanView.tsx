import { Fragment } from 'react';
import { PhaseControls, GoalEditor } from './PhaseControls';
import { SourceList } from './SourceList';
import { CurrentGuide } from './CurrentGuide';
import { StepContent } from './StepContent';
import { MarkdownImport } from './MarkdownImport';
import { ThreadList } from './ThreadList';
import { useEffect, useRef, useState } from 'react';
import type { GuideRailStorage, Plan, StepStatus } from '../../storage/schema';
import type { RunCommand } from '../use-planner';
import { TextForm } from './TextForm';
import { StepForm } from './StepForm';
const statuses: { value: StepStatus; label: string; icon: string }[] = [
  { value: 'todo', label: '待办', icon: '○' }, { value: 'current', label: '当前', icon: '●' },
  { value: 'done', label: '完成', icon: '✓' }, { value: 'blocked', label: '阻塞', icon: '!' },
];
export function PlanView({ plan, data, busy, run, initialStepId, pageUrl }: { plan: Plan; data: GuideRailStorage; busy: boolean; run: RunCommand; initialStepId?: string; pageUrl?: string }) {
  const overviewRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<string | null>(initialStepId ?? null);
  const [editing, setEditing] = useState(false);
  const [targetPhase, setTargetPhase] = useState(plan.phaseIds[0]);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const step = selected ? data.steps[selected] : null;
  const steps = plan.stepIds.map(id => data.steps[id]);
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-step-id="${selected ?? initialStepId ?? ''}"]`);
    if (list && row) {
      const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
      list.scrollTop += offset - (list.clientHeight - row.offsetHeight) / 2;
    }
  }, [selected, initialStepId]);
  const selectStep = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => {
      const detail = detailRef.current; const overview = overviewRef.current;
      if (detail && overview) {
        detail.style.scrollMarginTop = `${overview.offsetHeight + 12}px`;
        detail.scrollIntoView({ block: 'start' });
      }
    });
  };
  let number = 1;
  while (steps.some(item => item.key.toLowerCase() === `step-${String(number).padStart(2, '0')}`)) number++;
  return <section aria-label="执行计划">
    <GoalEditor plan={plan} run={run} busy={busy} />
    <div className="plan-overview" ref={overviewRef}>
    <div className="section-heading"><h2>{plan.title}</h2><button disabled={busy} onClick={() => setRenaming(!renaming)}>改标题</button></div>

    <CurrentGuide data={data} plan={plan} busy={busy || editing} run={run} onSelect={selectStep} />
    {!steps.length && <p className="muted">还没有步骤，添加第一步。</p>}
    <ol className="steps" ref={listRef}>{steps.map((item, index) => {
      const status = statuses.find(option => option.value === item.status)!;
      return <Fragment key={item.id}>{(index === 0 || steps[index - 1].phaseId !== item.phaseId) && <li className="phase-heading"><strong>{data.phases[item.phaseId].title}</strong><small>{steps.filter(s => s.phaseId === item.phaseId && s.status === 'done').length} / {steps.filter(s => s.phaseId === item.phaseId).length} 步完成</small></li>}<li data-step-id={item.id} className={`${item.status} ${item.id === selected ? 'selected' : ''}`}>
        <button className="step-select" aria-pressed={item.id === selected} disabled={editing} onClick={() => selectStep(item.id)}>
          <span className="status-icon" aria-label={status.label}>{status.icon}</span><span><small>{item.key}</small><span className="step-title">{item.title}</span></span>
        </button>
        <div className="order-controls"><button aria-label={`上移 ${item.key}`} disabled={busy || index === 0 || steps[index - 1]?.phaseId !== item.phaseId} onClick={() => { void run({ type: 'moveStep', id: item.id, direction: -1 }); }}>↑</button><button aria-label={`下移 ${item.key}`} disabled={busy || index === steps.length - 1 || steps[index + 1]?.phaseId !== item.phaseId} onClick={() => { void run({ type: 'moveStep', id: item.id, direction: 1 }); }}>↓</button></div>
      </li></Fragment>;
    })}</ol>
    {plan.phaseIds.filter(id => !steps.some(step => step.phaseId === id)).map(id => <p key={id} className="muted">{data.phases[id].title} · 暂无步骤</p>)}
    </div>
    <PhaseControls plan={plan} data={data} run={run} busy={busy || editing} />
    {renaming && <TextForm label="计划标题" max={180} initial={plan.title} busy={busy} onCancel={() => setRenaming(false)} onSave={title => run({ type: 'renamePlan', id: plan.id, title })} />}
    {!adding && <button disabled={busy || editing} onClick={() => setAdding(true)}>＋ 添加步骤</button>}
    {adding && <label>新步骤所属阶段<select value={plan.phaseIds.includes(targetPhase) ? targetPhase : plan.phaseIds[0]} disabled={busy} onChange={event => setTargetPhase(event.target.value)}>{plan.phaseIds.map(id => <option key={id} value={id}>{data.phases[id].title}</option>)}</select></label>}
    {adding && <StepForm suggestedKey={`STEP-${String(number).padStart(2, '0')}`} busy={busy} onCancel={() => setAdding(false)} onSave={values => run({ type: 'createStep', phaseId: plan.phaseIds.includes(targetPhase) ? targetPhase : plan.phaseIds[0], planId: plan.id, key: values.key, title: values.title, instructions: values.instructions, commands: values.commands, completionCriteria: values.completionCriteria })} />}
    <MarkdownImport planId={plan.id} existingKeys={steps.map(item => item.key)} busy={busy} run={run} />
    {plan.markdownSource && <details className="source-details"><summary>查看导入原文</summary><pre className="command-block">{plan.markdownSource}</pre></details>}
    {step && <section ref={detailRef} className="step-detail" aria-label="所选步骤">
      <p className="eyebrow">{step.status === 'current' ? '当前步骤 · 操作详情' : '正在查看此步骤（不会改变当前进度）'}</p><h3>{step.key} · {step.title}</h3>
      {editing ? <StepForm key={step.id} step={step} busy={busy} onCancel={() => setEditing(false)} onSave={values => run({ type: 'editStep', id: step.id, ...values })} /> : <>
        <div className="status-controls" aria-label="步骤状态">{statuses.map(status => <button key={status.value} disabled={busy} aria-pressed={step.status === status.value} onClick={() => { void run({ type: 'setStatus', id: step.id, status: status.value }); }}>{status.icon} {status.label}</button>)}</div>
        <label>所属阶段<select disabled={busy} value={step.phaseId} onChange={event => { void run({ type: 'assignPhase', stepId: step.id, phaseId: event.target.value }); }}>{plan.phaseIds.map(id => <option key={id} value={id}>{data.phases[id].title}</option>)}</select></label>
        <StepContent step={step} />
        <div className="actions"><button disabled={busy} onClick={() => setEditing(true)}>编辑步骤</button><button className="danger" disabled={busy} onClick={() => {
          if (window.confirm(`删除「${step.key} ${step.title}」及其关联问题？此操作无法撤销。`)) void run({ type: 'deleteStep', id: step.id }).then(ok => { if (ok) setSelected(null); });
        }}>删除步骤</button></div>
      </>}
      <SourceList key={`sources-${step.id}`} stepId={step.id} data={data} busy={busy} run={run} />
      <ThreadList key={step.id} step={step} data={data} busy={busy} run={run} pageUrl={pageUrl} />
    </section>}
  </section>;
}
