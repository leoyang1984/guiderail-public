// @vitest-environment jsdom
// Resolve media queries and theme variables without a browser. This checks CSS
// contracts and contrast; it intentionally does not claim pixel-layout coverage.
/// <reference types="vite/client" />
import css from '../src/sidepanel/reader.css?raw';
import legacy from '../src/sidepanel/style.css?raw';
import postcss from 'postcss';
import { afterEach, expect, it } from 'vitest';
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });
function resolved(width: number, dark: boolean, coarse = false, reduced = false) {
  const tree = postcss.parse(legacy + '\n' + css);
  tree.walkAtRules('media', rule => {
    const matches = Array.from(rule.params.matchAll(/\(([^:]+):\s*([^\)]+)\)/g)).every(([, key, value]) => {
      switch (key.trim()) {
        case 'max-width': return width <= parseInt(value);
        case 'min-width': return width >= parseInt(value);
        case 'max-height': return false;
        case 'prefers-color-scheme': return value === (dark ? 'dark' : 'light');
        case 'pointer': return value === (coarse ? 'coarse' : 'fine');
        case 'prefers-reduced-motion': return value === (reduced ? 'reduce' : 'no-preference');
        default: throw new Error(`Unhandled media query: ${rule.params}`);
      }
    });
    if (matches) rule.replaceWith(...(rule.nodes ?? [])); else rule.remove();
  });
  const vars: Record<string, string> = {};
  tree.walkRules(':root', rule => { rule.walkDecls(/^--/, d => { vars[d.prop] = d.value; }); });
  tree.walkDecls(d => { d.value = d.value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => { expect(vars[name], name).toBeDefined(); return vars[name]; }); });
  const style = document.createElement('style'); style.textContent = tree.toString(); document.head.append(style);
  document.body.innerHTML = '<main class="reader-app"><div class="reading-tools"><button class="primary">原文</button><details class="reply-more"><summary>更多操作</summary><div class="reading-secondary"></div></details></div><h2 class="reading-title">长标题</h2><div class="reply-body"><pre><code>long_code_line</code></pre><table><tbody><tr><td>内容</td></tr></tbody></table></div><div class="collection-tabs"><button aria-pressed="true">当前对话</button></div></main>';
  return { vars, style: (selector: string) => getComputedStyle(document.querySelector(selector)!) };
}
it.each([320, 360, 390, 720, 1024].flatMap(width => [false, true].map(dark => ({ width, dark }))))('supports $width px / dark=$dark without fixed-width content', ({ width, dark }) => {
  const { style } = resolved(width, dark);
  expect(style('.reading-title').fontSize).toBe(width <= 360 ? '20px' : width >= 800 ? '28px' : '23px');
  expect(style('.reading-title').fontFamily).toContain('Songti SC');
  expect(style('main').paddingLeft).toBe(width <= 360 ? '14px' : width >= 800 ? '28px' : '20px');
  expect(style('main').maxWidth).toBe('720px');
  expect(style('.reading-tools').flexWrap).toBe('wrap');
  expect(style('.reading-title').overflowWrap).toBe('anywhere');
  expect(style('pre').overflowX).toBe('auto');
  expect(style('table').overflowX).toBe('auto');
  expect(style('.reply-body').fontSize).toBe(width <= 360 ? '15px' : '16px');
  expect(style('button.primary').color).toBe(dark ? 'rgb(32, 37, 27)' : 'rgb(255, 255, 255)');
  expect(style('main').color).toBe(dark ? 'rgb(232, 227, 216)' : 'rgb(48, 47, 42)');
  expect(style('.collection-tabs').backgroundColor).toBe('rgba(0, 0, 0, 0)');
});
function luminance(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb.reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
it.each([false, true])('preserves readable theme colors, dark=%s', dark => {
  const { vars } = resolved(390, dark);
  for (const [fg, bg] of [['ink', 'paper'], ['muted', 'paper'], ['muted', 'surface'], ['on-accent', 'accent'], ['link', 'paper'], ['quote', 'paper'], ['danger', 'danger-bg']]) {
    const [low, high] = [luminance(vars[`--reader-${fg}`]), luminance(vars[`--reader-${bg}`])].sort((a, b) => a - b);
    expect((high + .05) / (low + .05), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
});
it('keeps large touch targets and honors reduced motion', () => {
  const { style } = resolved(320, false, true, true);
  expect(style('summary').minHeight).toBe('44px'); expect(style('button').minHeight).toBe('44px');
  expect(style('button').transition).toBe('none');
});
it('hides routine reading hints while keeping save and error feedback visible', () => {
  const { style } = resolved(320, false);
  document.querySelector('main')!.insertAdjacentHTML('afterbegin', '<header class="app-header"><h1>GuideRail</h1><span class="app-tagline">说明</span><span class="save-status">保存中</span></header><p class="capture-note" data-routine="true">收藏提示</p><p class="capture-note warning" data-routine="false">连接异常</p>');
  expect(style('.app-tagline').display).toBe('none');
  expect(style('[data-routine="true"]').display).toBe('none');
  expect(style('.save-status').display).not.toBe('none');
  expect(style('.warning').display).not.toBe('none');
  document.querySelector('.reading-title')!.remove();
  expect(style('.app-tagline').display).not.toBe('none');
  expect(style('[data-routine="true"]').display).not.toBe('none');
});
it('defines both themes with the same tokens and no component color literals', () => {
  const tree = postcss.parse(css); const roots: string[][] = [];
  tree.walkRules(':root', r => { const names: string[] = []; r.walkDecls(/^--/, d => { names.push(d.prop); }); roots.push(names.sort()); });
  expect(roots).toHaveLength(2); expect(roots[0]).toEqual(roots[1]);
  tree.walkDecls(d => { if (!d.prop.startsWith('--')) expect(d.value).not.toMatch(/#[\da-f]{3,8}\b/i); });
  const contexts = new Map<string, Set<string>>();
  tree.walkRules(r => {
    const context = r.parent?.type === 'atrule' ? r.parent.toString().split('{')[0] : 'base';
    const seen = contexts.get(context) ?? new Set<string>();
    expect(seen.has(r.selector), `duplicate ${r.selector} in ${context}`).toBe(false); seen.add(r.selector); contexts.set(context, seen);
  });
});
