import { useState } from 'react';
import type { Thread } from '../../storage/schema';
import { getThreadUrl } from '../../domain/thread';
import { getChatGPTConversationId } from '../../domain/conversation';
export function ThreadForm({ thread, defaultUrl = '', busy, onSave, onCancel }: {
  thread?: Thread; defaultUrl?: string; busy: boolean; onCancel: () => void;
  onSave: (values: { title: string; description: string; pageUrl: string }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(thread?.title ?? '');
  const [description, setDescription] = useState(thread?.description ?? '');
  const [pageUrl, setPageUrl] = useState(thread ? getThreadUrl(thread) ?? '' : defaultUrl);
  const invalidUrl = !!pageUrl.trim() && !getChatGPTConversationId(pageUrl.trim());
  return <form onSubmit={event => { event.preventDefault(); if (title.trim() && !invalidUrl) void onSave({ title: title.trim(), description, pageUrl: pageUrl.trim() }).then(ok => { if (ok) onCancel(); }); }}>
    <label>问题标题<input required autoFocus maxLength={240} disabled={busy} value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label>问题说明<textarea rows={3} maxLength={10000} disabled={busy} value={description} onChange={event => setDescription(event.target.value)} /></label>
    <label>关联对话（可选）<input type="url" maxLength={4096} disabled={busy} placeholder="https://chatgpt.com/c/…" value={pageUrl} aria-invalid={invalidUrl} onChange={event => setPageUrl(event.target.value)} /></label>
    {invalidUrl && <p className="error">请输入已保存的 ChatGPT 对话链接，或留空。</p>}
    <div className="actions"><button type="submit" disabled={busy || !title.trim() || invalidUrl}>保存问题</button><button type="button" disabled={busy} onClick={onCancel}>取消</button></div>
  </form>;
}
