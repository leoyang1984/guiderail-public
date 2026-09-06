import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { MessageSource } from '../storage/schema';

export function replyTitle(source: MessageSource): string {
  return source.title || source.text.split('\n').find(line => line.trim())?.trim().slice(0, 80) || '收藏的回复';
}

export function exportFilename(source: MessageSource): string {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(source.id)) throw new Error('Invalid reply ID');
  return `GuideRail-${source.id}.md`;
}

export function replyMarkdown(source: MessageSource, exportedAt = new Date().toISOString()): string {
  let body = source.text;
  if (source.html) {
    const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
    converter.use(gfm);
    const dropped = new Set(['script', 'style', 'iframe', 'img', 'svg', 'object', 'embed', 'form', 'input', 'button', 'video', 'audio']);
    converter.remove(node => dropped.has(node.nodeName.toLowerCase()));
    converter.addRule('safeLinks', {
      filter: 'a',
      replacement: (content, node) => {
        try {
          const url = new URL((node as HTMLElement).getAttribute('href') || '', 'https://chatgpt.com');
          if (['http:', 'https:'].includes(url.protocol)) return `[${content}](<${url.href.replace(/>/g, '%3E')}>)`;
        } catch { /* Preserve text for invalid links. */ }
        return content;
      },
    });
    // Choose a fence longer than any backtick run in the code itself.
    converter.addRule('safeCodeBlocks', {
      filter: 'pre',
      replacement: (_content, node) => {
        const code = node.querySelector('code');
        const text = (code ?? node).textContent ?? '';
        const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), match => match[0].length + 1)));
        const language = code?.className.match(/(?:^|\s)language-([\w+-]+)/)?.[1] ?? '';
        return `\n\n${fence}${language}\n${text.replace(/\n$/, '')}\n${fence}\n\n`;
      },
    });
    body = converter.turndown(source.html).trim() || source.text;
  }
  const fields = {
    title: replyTitle(source),
    source: source.pageUrl,
    conversation_id: source.conversationId,
    message_id: source.messageId,
    guiderail_id: source.id,
    role: source.role,
    created: source.createdAt,
    updated: source.updatedAt,
    exported: exportedAt,
  };
  // JSON-quoted strings are YAML-compatible and cannot inject new frontmatter fields.
  const yaml = Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
  return `---\n${yaml}\ntags:\n  - guiderail\n  - chatgpt\n---\n\n${body.trim()}\n`;
}
