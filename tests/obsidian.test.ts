import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { exportFilename, replyMarkdown } from '../src/export/obsidian';
import type { MessageSource } from '../src/storage/schema';

const source: MessageSource = { id: 'saved-123', conversationId: 'chat-1', messageId: 'msg-2', role: 'assistant', pageUrl: 'https://chatgpt.com/c/chat-1', text: 'Original body', createdAt: '2026-09-05T12:00:00.000Z', updatedAt: '2026-09-05T12:01:00.000Z' };
it('round-trips YAML punctuation, multiline strings and property types', () => {
  const title = '标题: "引号" #tag\n---\ntags: [evil]\\路径';
  const result = replyMarkdown({ ...source, title }, '2026-09-05T13:00:00.000Z');
  const frontmatter = result.split('\n---\n')[0].slice(4);
  expect(parse(frontmatter)).toEqual({ title, source: source.pageUrl, conversation_id: 'chat-1', message_id: 'msg-2', guiderail_id: 'saved-123', role: 'assistant', created: source.createdAt, updated: source.updatedAt, exported: '2026-09-05T13:00:00.000Z', tags: ['guiderail', 'chatgpt'] });
  expect(result.endsWith('\n\nOriginal body\n')).toBe(true);
});
it('preserves legacy Markdown text including fenced code', () => {
  const text = '# Steps\n\n```sh\necho hello\n```';
  expect(replyMarkdown({ ...source, text })).toContain(text);
});
it('converts HTML headings, lists, links, emphasis and code to Markdown', () => {
  const html = '<h2>步骤</h2><ul><li><strong>安装</strong></li><li><a href="https://example.com/a">参考</a></li></ul><pre><code class="language-js">const fence = "```";\n</code></pre><blockquote><p>注意</p></blockquote>';
  const result = replyMarkdown({ ...source, html });
  expect(result).toContain('## 步骤');
  expect(result).toMatch(/- +\*\*安装\*\*/);
  expect(result).toContain('[参考](<https://example.com/a>)');
  expect(result).toContain('````js\nconst fence = "```";\n````');
  expect(result).toContain('> 注意');
});
it('exports tables and removes scripts, controls and unsafe link targets', () => {
  const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table><script>bad()</script><button>收藏</button><a href="javascript:bad()">Safe label</a>';
  const result = replyMarkdown({ ...source, html });
  expect(result).toContain('| A | B |');
  expect(result).toContain('Safe label');
  expect(result).not.toContain('bad()');
  expect(result).not.toContain('收藏');
});
it('uses a stable filename unaffected by title edits or path characters', () => {
  expect(exportFilename({ ...source, title: '../evil:?.md' })).toBe('GuideRail-saved-123.md');
  expect(() => exportFilename({ ...source, id: '../escape' })).toThrow();
});
