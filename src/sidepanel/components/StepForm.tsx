import { useState } from 'react';
import type { Step } from '../../storage/schema';
export interface StepFormValues { key: string; title: string; notes: string; instructions: string; commands: string; completionCriteria: string }
export function StepForm({ step, suggestedKey = '', busy, onSave, onCancel }: {
  step?: Step; suggestedKey?: string; busy: boolean; onCancel: () => void;
  onSave: (values: StepFormValues) => Promise<boolean>;
}) {
  const [key, setKey] = useState(step?.key ?? suggestedKey);
  const [title, setTitle] = useState(step?.title ?? '');
  const [notes, setNotes] = useState(step?.notes ?? '');
  const [instructions, setInstructions] = useState(step?.instructions ?? '');
  const [commands, setCommands] = useState(step?.commands ?? '');
  const [completionCriteria, setCompletionCriteria] = useState(step?.completionCriteria ?? '');
  return <form onSubmit={event => { event.preventDefault(); if (key.trim() && title.trim()) void onSave({ key: key.trim(), title: title.trim(), notes, instructions, commands, completionCriteria }).then(ok => { if (ok) onCancel(); }); }}>
    <label>步骤编号<input autoFocus required disabled={busy} maxLength={40} value={key} onChange={event => setKey(event.target.value)} /></label>
    <label>步骤标题<input required disabled={busy} maxLength={240} value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label>操作说明<textarea rows={4} disabled={busy} maxLength={10000} value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="这一步具体做什么？可粘贴 ChatGPT 的操作建议。" /></label>
    <label>命令（仅保存，不执行）<textarea className="command-input" rows={3} disabled={busy} maxLength={10000} value={commands} onChange={event => setCommands(event.target.value)} placeholder="粘贴需要手动执行的命令" /></label>
    <label>完成标准<textarea rows={2} disabled={busy} maxLength={10000} value={completionCriteria} onChange={event => setCompletionCriteria(event.target.value)} placeholder="看到什么结果，才算完成这一步？" /></label>
    {step && <label>备注<textarea rows={2} disabled={busy} maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} /></label>}
    <div className="actions"><button type="submit" disabled={busy || !key.trim() || !title.trim()}>保存步骤</button><button type="button" disabled={busy} onClick={onCancel}>取消</button></div>
  </form>;
}
