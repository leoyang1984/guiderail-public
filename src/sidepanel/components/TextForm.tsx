import { useState } from 'react';
export function TextForm({ label, initial = '', max = 120, busy, onSave, onCancel }: {
  label: string; initial?: string; max?: number; busy: boolean;
  onSave: (value: string) => Promise<boolean>; onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return <form onSubmit={event => { event.preventDefault(); if (value.trim()) void onSave(value.trim()).then(ok => { if (ok) onCancel(); }); }}>
    <label>{label}<input autoFocus required maxLength={max} value={value} onChange={event => setValue(event.target.value)} /></label>
    <div className="actions"><button disabled={busy || !value.trim()} type="submit">保存</button><button disabled={busy} type="button" onClick={onCancel}>取消</button></div>
  </form>;
}
