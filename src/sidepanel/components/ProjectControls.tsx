import { useState } from 'react';
import type { GuideRailStorage } from '../../storage/schema';
import { resolveConversation } from '../../domain/conversation';
import type { RunCommand } from '../use-planner';
import { TextForm } from './TextForm';
export function ProjectControls({ data, run, busy, conversationId, pageUrl }: {
  data: GuideRailStorage; run: RunCommand; busy: boolean; conversationId: string | null; pageUrl: string;
}) {
  const [mode, setMode] = useState<'create' | 'rename' | null>(null);
  const { project: current, binding } = resolveConversation(data, conversationId);
  const bindProject = (id: string) => {
    const planId = data.projects[id]?.activePlanId;
    if (conversationId && planId) void run({ type: 'bindConversation', conversationId, pageUrl, projectId: id, planId });
  };
  return <section className="project-controls" aria-label="项目管理">
    {conversationId && <p className="binding-state">{binding ? '此对话已关联项目' : '此对话尚未关联项目。请选择已有项目并关联，或新建项目。'}</p>}
    <label>{binding ? '关联项目' : '项目'}<select disabled={busy || mode !== null || !Object.keys(data.projects).length} value={current?.id ?? ''} onChange={event => {
      const id = event.target.value;
      if (binding) {
        if (window.confirm(`将此对话改为关联「${data.projects[id].name}」？原项目与步骤会保留。`)) bindProject(id);
      } else void run({ type: 'selectProject', id });
    }}>
      {!current && <option value="">尚无项目</option>}
      {Object.values(data.projects).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select></label>
    {!mode && <div className="actions">
      {conversationId && !binding && current && <button disabled={busy} onClick={() => bindProject(current.id)}>关联此项目</button>}
      <button disabled={busy} onClick={() => setMode('create')}>{conversationId ? '＋ 新建并关联项目' : '＋ 新建项目'}</button>
      {current && <button disabled={busy} onClick={() => setMode('rename')}>重命名</button>}
    </div>}
    {mode && <TextForm key={`${mode}-${current?.id}`} label={mode === 'create' ? '项目名称' : '重命名项目'} initial={mode === 'rename' ? current?.name : ''} busy={busy} onCancel={() => setMode(null)} onSave={name => {
      if (mode === 'rename') return run({ type: 'renameProject', id: current!.id, name });
      if (binding && !window.confirm('新建项目并替换此对话的关联？原项目与步骤会保留。')) return Promise.resolve(false);
      return run({ type: 'createProject', name, ...(conversationId ? { conversation: { conversationId, pageUrl } } : {}) });
    }} />}
    {!current && !mode && <p className="muted">创建第一个项目，开始整理执行步骤。</p>}
  </section>;
}
