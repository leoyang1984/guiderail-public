import { useEffect, useState } from 'react';

export function CopyReply({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [status]);
  return <button className="quiet-button" disabled={status === 'copying'} aria-live="polite" onClick={async () => {
    setStatus('copying');
    try { await navigator.clipboard.writeText(text); setStatus('copied'); }
    catch { setStatus('failed'); }
  }}>{status === 'copied' ? '已复制' : status === 'copying' ? '复制中…' : status === 'failed' ? '复制失败，重试' : '复制全文'}</button>;
}
