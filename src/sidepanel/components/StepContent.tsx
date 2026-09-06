import type { Step } from '../../storage/schema';
export function StepContent({ step }: { step: Step }) {
  return <div className="step-content">
    <h4>操作说明</h4><p className={step.instructions ? 'notes' : 'muted'}>{step.instructions || '尚未填写。编辑步骤，把具体操作保存在这里。'}</p>
    {step.commands && <><h4>命令</h4><pre className="command-block"><code>{step.commands}</code></pre><p className="muted">命令仅供查看和手动复制，不会自动执行。</p></>}
    <h4>完成标准</h4><p className={step.completionCriteria ? 'notes' : 'muted'}>{step.completionCriteria || '尚未填写。建议记录成功时应看到的结果。'}</p>
    {step.notes && <><h4>备注</h4><p className="notes">{step.notes}</p></>}
  </div>;
}
