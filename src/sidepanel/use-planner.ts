import { useCallback, useEffect, useState } from 'react';
import { ChromeStorageRepository, sendCommand, STORAGE_KEY } from '../storage/storage';
import type { Command, GuideRailStorage } from '../storage/schema';

export function usePlanner(available: boolean) {
  const [data, setData] = useState<GuideRailStorage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!available) return;
    let active = true; let revision = 0;
    const repository = new ChromeStorageRepository();
    const refresh = async () => {
      const request = ++revision;
      try { const saved = await repository.read(); if (active && revision === request) { setData(saved); setError(''); } }
      catch (cause) { console.error('Could not load GuideRail.', cause); if (active && revision === request) { setData(null); setError('无法读取本地数据。请重新打开侧边栏。'); } }
    };
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => { if (area === 'local' && STORAGE_KEY in changes) void refresh(); };
    chrome.storage.onChanged.addListener(changed);
    void refresh();
    return () => { active = false; chrome.storage.onChanged.removeListener(changed); };
  }, [available]);
  const run = useCallback(async (command: Command): Promise<boolean> => {
    setBusy(true); setError('');
    try { await sendCommand(command); return true; }
    catch (cause) { console.error('Could not save GuideRail.', cause); setError(command.type === 'restoreBackup' ? '恢复失败：数据可能已在其他窗口更改，或备份无效。请检查后重新确认。' : command.type === 'completeAndAdvance' ? '未能推进：进度或问题可能已在其他窗口变化，请检查后重试。' : '未能保存更改，请检查内容和链接后重试。步骤编号不可重复。'); return false; }
    finally { setBusy(false); }
  }, []);
  return { data, error, busy, run };
}
export type RunCommand = ReturnType<typeof usePlanner>['run'];
