import type { GuideRailStorage, Plan } from '../../storage/schema';
import { getGuidance } from '../../domain/guidance';
import type { RunCommand } from '../use-planner';
export function CurrentGuide({ data, plan, busy, run, onSelect }: {
  data: GuideRailStorage; plan: Plan; busy: boolean; run: RunCommand; onSelect: (id: string) => void;
}) {
  const guide = getGuidance(data, plan);
  const { current, next, total, completed, unresolved } = guide;
  return <section className="current-guide" aria-label="执行导航" aria-live="polite">
    <div className="guide-progress"><span>{completed} / {total} 步已完成（按步骤数）</span><span>{total ? Math.round(completed / total * 100) : 0}%</span></div>
    <progress max={total || 1} value={completed} aria-label="已完成步骤比例" />
    {!total ? <p className="guide-title">添加或导入步骤，建立执行路线。</p> : completed === total ? <p className="guide-title">✓ 所有步骤已完成，请核对目标完成条件</p> : <>
      <p className="eyebrow">{current ? `当前位置 · 第 ${guide.currentIndex + 1} / ${total} 步` : '尚未设置当前步骤'}</p>
      {current && <p className="eyebrow">所属阶段：{data.phases[current.phaseId].title}</p>}
      <p className="guide-title">{current ? `${current.key} · ${current.title}` : next?.status === 'blocked' ? '下一项工作被阻塞' : '选择起点，开始执行'}</p>
      {unresolved > 0 && <p className="guide-warning">当前步骤有 {unresolved} 个未解决问题。</p>}
      <p className="guide-next">{next ? `${guide.returning ? '随后回到' : '下一步'}：${next.key} · ${next.title}${next.status === 'blocked' ? '（阻塞中）' : ''}` : '这是最后一个未完成步骤。'}</p>
      <div className="actions">
        {current && <><button disabled={busy} onClick={() => onSelect(current.id)}>查看当前操作</button><button className="primary" disabled={busy} onClick={() => {
          if (unresolved && !window.confirm(`当前步骤仍有 ${unresolved} 个未解决问题。确认将步骤标记完成？问题记录会保留。`)) return;
          void run({ type: 'completeAndAdvance', id: current.id, expectedNextStepId: next?.id ?? null, acknowledgeIssues: unresolved > 0 }).then(ok => { if (ok) onSelect(next?.id ?? current.id); });
        }}>{!next ? '完成最后一步' : next.status === 'blocked' ? '完成当前步，停在阻塞处' : '完成并进入下一步'}</button></>}
        {!current && next && (next.status === 'blocked' ? <button disabled={busy} onClick={() => onSelect(next.id)}>查看阻塞步骤</button> : <button className="primary" disabled={busy} onClick={() => {
          void run({ type: 'setStatus', id: next.id, status: 'current' }).then(ok => { if (ok) onSelect(next.id); });
        }}>从 {next.key} 开始</button>)}
      </div>
    </>}
  </section>;
}
