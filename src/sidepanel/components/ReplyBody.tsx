import { createElement, type ReactNode } from 'react';
const allowed = new Set(['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code', 'strong', 'b', 'em', 'i', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br', 'a', 'del']);
const dropped = new Set(['script', 'style', 'iframe', 'img', 'svg', 'object', 'embed', 'form', 'input', 'button', 'video', 'audio']);
export function ReplyBody({ html, text, title }: { html?: string; text: string; title?: string }) {
  if (!html) return <div className="reply-body legacy-reply">{text.split(/(```[\s\S]*?```)/g).map((part, index) => part.startsWith('```') ? <pre key={index}><code>{part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}</code></pre> : <p key={index}>{part}</p>)}</div>;
  // Template contents are inert; render an allowlisted React tree, never page HTML or attributes directly.
  const template = document.createElement('template'); template.innerHTML = html;
  // Only omit an identical opening heading from this detached display tree.
  // Never remove prose, later headings, or anything from the stored snapshot.
  let leading: Node | undefined = Array.from(template.content.childNodes).find(node => node.nodeType !== Node.COMMENT_NODE && (node.textContent?.trim() || node.nodeType === Node.ELEMENT_NODE));
  for (let depth = 0; depth < 40 && leading instanceof HTMLElement && leading.tagName === 'DIV'; depth++) {
    leading = Array.from(leading.childNodes).find(node => node.nodeType !== Node.COMMENT_NODE && (node.textContent?.trim() || node.nodeType === Node.ELEMENT_NODE));
  }
  if (title?.trim() && leading instanceof HTMLElement && /^H[1-6]$/.test(leading.tagName) && leading.textContent?.trim() === title.trim()) leading.remove();
  function render(node: Node, key: number, depth = 0): ReactNode {
    if (depth > 40) return node.textContent;
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (!(node instanceof HTMLElement)) return null;
    const tag = node.tagName.toLowerCase(); if (dropped.has(tag)) return null;
    const children = Array.from(node.childNodes).map((child, index) => render(child, index, depth + 1));
    if (!allowed.has(tag)) return createElement('span', { key }, children);
    const props: Record<string, unknown> = { key };
    if (tag === 'a') {
      try { const url = new URL(node.getAttribute('href') ?? '', 'https://chatgpt.com'); if (['https:', 'http:'].includes(url.protocol)) Object.assign(props, { href: url.href, target: '_blank', rel: 'noreferrer noopener' }); } catch { /* Keep link text. */ }
    }
    if (tag === 'br' || tag === 'hr') return createElement(tag, props);
    return createElement(tag, props, children);
  }
  return <div className="reply-body">{Array.from(template.content.childNodes).map((child, index) => render(child, index))}</div>;
}
