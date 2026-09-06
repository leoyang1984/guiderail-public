import { useRef, useState } from 'react';
import { ChromeStorageRepository } from '../../storage/storage';
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup } from '../../storage/backup';
import type { GuideRailStorage } from '../../storage/schema';
import type { RunCommand } from '../use-planner';

export function BackupControls({ data, busy, run }: { data: GuideRailStorage; busy: boolean; run: RunCommand }) {
  const [pending, setPending] = useState<GuideRailStorage | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [working, setWorking] = useState(false);
  const revision = useRef(0);
  async function exportBackup() {
    setWorking(true); setError(''); setNotice('');
    try {
      const text = serializeBackup(await new ChromeStorageRepository().read());
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `guiderail-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice('已发起备份下载，请在 Chrome 下载列表中确认文件。');
    } catch (cause) { console.error('Could not export backup.', cause); setError('无法导出备份，请重试。'); }
    finally { setWorking(false); }
  }
  async function readBackup(file: File) {
    const request = ++revision.current; setPending(null); setError(''); setNotice(''); setWorking(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('File too large');
      const parsed = parseBackup(await file.text());
      if (request === revision.current) setPending(parsed);
    } catch (cause) { console.error('Invalid backup.', cause); if (request === revision.current) setError('无效的 GuideRail 备份文件。请选择不超过 5 MB 的完整 JSON 备份。'); }
    finally { if (request === revision.current) setWorking(false); }
  }
  return <section className="backup-controls" aria-label="数据备份">
    <details><summary>备份与恢复</summary>
      <p className="muted">备份包含全部项目、目标、阶段、步骤、问题、对话关联及收录的原文快照。恢复会替换所有现有数据，建议先导出备份。</p>
      <button disabled={busy || working} onClick={() => { void exportBackup(); }}>导出 JSON 备份</button>
      <label>选择 JSON 备份<input type="file" accept=".json,application/json" disabled={busy || working} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readBackup(file); }} /></label>
      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="muted">{notice}</p>}
      {pending && <div>
        <p className="muted">备份校验通过：{Object.keys(pending.projects).length} 个项目，{Object.keys(pending.phases).length} 个阶段，{Object.keys(pending.steps).length} 个步骤，{Object.keys(pending.threads).length} 个问题，{Object.keys(pending.conversationBindings).length} 个对话关联，{Object.keys(pending.sources).length} 条原文快照，{Object.keys(pending.sourceLinks).length} 个步骤引用。</p>
        <div className="actions"><button className="danger" disabled={busy || working} onClick={() => {
          const expectedSource = JSON.stringify(data);
          if (!window.confirm(`替换全部现有数据？当前 ${Object.keys(data.projects).length} 个项目将被备份内容替换，此操作无法撤销。`)) return;
          void run({ type: 'restoreBackup', data: pending, expectedSource }).then(ok => { if (ok) { setPending(null); setNotice('备份已恢复。'); } });
        }}>替换现有数据</button><button disabled={busy || working} onClick={() => setPending(null)}>取消</button></div>
      </div>}
    </details>
  </section>;
}
