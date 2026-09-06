import { createElement, type ReactNode } from 'react';
const allowed = new Set(['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code', 'strong', 'b', 'em', 'i', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br', 'a', 'del']);
const dropped = new Set(['script', 'style', 'iframe', 'img', 'svg', 'object', 'embed', 'form', 'input', 'button', 'video', 'audio']);
export function ReplyBody({ html, text }: { html?: string; text: string }) {
  if (!html) return <div className="reply-body legacy-reply">{text.split(/(```[\s\S]*?```)/g).map((part, index) => part.startsWith('```') ? <pre key={index}><code>{part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}</code></pre> : <p key={index}>{part}</p>)}</div>;
  // Template contents are inert; render an allowlisted React tree, never page HTML or attributes directly.
  const template = document.createElement('template'); template.innerHTML = html;
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
