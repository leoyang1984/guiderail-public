import { useEffect, useRef, useState } from 'react';
import type { MessageSource } from '../../storage/schema';
import { exportFilename, replyMarkdown } from '../../export/obsidian';
import { loadDirectory, storeDirectory, writeNewFile, type DirectoryPicker, type ExportDirectory } from '../../export/directory';

export function ObsidianExport({ sources, label }: { sources: MessageSource[]; label: string }) {
  const [directory, setDirectory] = useState<ExportDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void loadDirectory().then(value => { if (active) setDirectory(value); })
      .catch(() => { if (active) setNotice('无法读取上次的目录，请重新选择。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  async function choose() {
    if (!picker || lock.current) return;
    lock.current = true; setWorking(true); setNotice('');
    try {
      const next = await picker({ mode: 'readwrite', id: 'guiderail-obsidian' });
      setDirectory(next);
      try { await storeDirectory(next); setNotice('目录已保存。'); }
      catch { setNotice('本次可导出，但目录未能记住，下次需要重新选择。'); }
    } catch (error) {
      setNotice(error instanceof DOMException && error.name === 'AbortError' ? '已取消选择。' : '无法选择目录，请重试；也可打开一条收藏，使用顶部“在新标签页阅读”后选择。');
    } finally { lock.current = false; setWorking(false); }
  }
  async function exportReplies() {
    if (!directory || lock.current || !sources.length) return;
    lock.current = true; setWorking(true); setNotice('');
    let written = 0, skipped = 0;
    try {
      // Request permission directly inside the click handler, before any database work.
      if (await directory.requestPermission({ mode: 'readwrite' }) !== 'granted') {
        setNotice('未获得目录写入权限，请授权或重新选择目录。'); return;
      }
      const exportedAt = new Date().toISOString();
      for (const source of sources) {
        const result = await writeNewFile(directory, exportFilename(source), replyMarkdown(source, exportedAt));
        if (result === 'written') written++; else skipped++;
      }
      setNotice(`已导出 ${written} 条，跳过 ${skipped} 个已有文件。`);
    } catch (error) {
      setNotice(`已导出 ${written} 条，跳过 ${skipped} 个已有文件；其余未完成。${error instanceof DOMException && error.name === 'NotAllowedError' ? '请重新授权目录。' : '请检查目录权限和磁盘空间后重试。'}`);
    } finally { lock.current = false; setWorking(false); }
  }
  return <details className="obsidian-export"><summary>导出到 Obsidian</summary>
    <p className="muted">选择 Obsidian 仓库内的文件夹，保存为带 YAML 属性的 Markdown。已有同名文件会跳过，保留你的笔记修改。</p>
    <p className="muted">目录：{loading ? '正在读取…' : directory?.name ?? '未选择'}</p>
    <div className="actions"><button disabled={loading || working || !picker} onClick={() => { void choose(); }}>{directory ? '更换文件夹' : '选择文件夹'}</button>
      <button disabled={loading || working || !directory || !sources.length} onClick={() => { void exportReplies(); }}>{working ? '处理中…' : label}</button></div>
    {!picker && <p role="status">当前页面不支持目录选择，可打开一条收藏，使用顶部“在新标签页阅读”后选择。</p>}
    {notice && <p role="status">{notice}</p>}
  </details>;
}
