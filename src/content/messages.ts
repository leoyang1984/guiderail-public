import { locateMessage } from './locate';
import type { Capture } from '../storage/schema';

(() => {
  let locateGeneration = 0;
  const saving = new WeakSet<HTMLElement>();
  const conversation = () => location.pathname.match(/^\/c\/([a-zA-Z0-9_-]+)\/?$/)?.[1];
  const streaming = () => !!document.querySelector('[data-testid="stop-button"], .result-streaming');
  function snapshot(el: HTMLElement): Capture | null {
    const conversationId = conversation(); const messageId = el.dataset.messageId;
    const role = el.dataset.messageAuthorRole;
    if (!el.isConnected || !conversationId || !messageId || !['assistant', 'user'].includes(role ?? '')) return null;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-guiderail],button,img,svg,iframe,style,script,video,audio').forEach(node => node.remove());
    const html = clone.innerHTML;
    clone.querySelectorAll('pre').forEach(pre => { pre.textContent = `\n\`\`\`\n${pre.querySelector('code')?.textContent ?? pre.textContent}\n\`\`\`\n`; });
    clone.querySelectorAll('p,li,h1,h2,h3,h4,blockquote,br,tr').forEach(block => { block.append(document.createTextNode('\n')); });
    const text = clone.textContent || '';
    return { conversationId, messageId, role: role as Capture['role'], pageUrl: `https://chatgpt.com/c/${conversationId}`, text: text.trim(), html };
  }
  function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') { const el = document.createElement(tag); el.textContent = text; return el; }
  async function collect(el: HTMLElement) {
    if (streaming() || saving.has(el)) return;
    const capture = snapshot(el); if (!capture?.text) return;
    const button = el.querySelector<HTMLButtonElement>('[data-guiderail="collect"]'); if (!button) return;
    saving.add(el); button.textContent = '保存中…';
    try {
      const result = await chrome.runtime.sendMessage({ kind: 'guiderail:command', command: { type: 'saveReply', capture } });
      if (!result?.ok) {
        button.textContent = result?.error === 'conversation-changed' ? '对话正在切换，请稍后重试' : '保存失败，点击重试';
        return;
      }
      button.textContent = '✓ 已收藏 · 在侧栏阅读';
    } catch (error) {
      button.textContent = !chrome.runtime?.id || /extension context invalidated/i.test(String(error))
        ? '扩展已更新，请刷新此页面后收藏' : '收藏连接失败，点击重试';
    }
    finally { saving.delete(el); }
  }
  function scan() {
    document.querySelectorAll<HTMLElement>('[data-message-id][data-message-author-role="assistant"]').forEach(el => {
      let button = el.querySelector<HTMLButtonElement>('[data-guiderail="collect"]');
      if (!button) { button = node('button', '☆ 收藏这条回复'); button.dataset.guiderail = 'collect'; button.style.cssText = 'font:12px sans-serif;padding:5px 10px;margin:8px 0;border:1px solid #789;border-radius:5px;background:#f5faf7;color:#234;cursor:pointer'; button.onclick = () => { void collect(el); }; el.append(button); }
      button.disabled = streaming() || !conversation() || saving.has(el);
    });
  }
  setInterval(scan, 1200); scan();
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.kind === 'guiderail:longReplies') {
      const replies = streaming() ? [] : Array.from(document.querySelectorAll<HTMLElement>('[data-message-id][data-message-author-role="assistant"]')).map(snapshot).filter((item): item is Capture => !!item && item.text.length >= 300).sort((a, b) => b.text.length - a.text.length).slice(0, 5);
      respond({ replies }); return;
    }
    if (message?.kind === 'guiderail:status') { respond({ available: !!document.querySelector('[data-message-id]'), streaming: streaming() }); return; }
    if (message?.kind !== 'guiderail:locate') return;
    const generation = ++locateGeneration;
    if (conversation() !== message.conversationId) { respond({ found: false, reason: 'cancelled' }); return; }
    let interrupted = false;
    const interrupt = () => { interrupted = true; };
    const keyInterrupt = (event: KeyboardEvent) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Escape', ' '].includes(event.key)) interrupt(); };
    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('touchstart', interrupt, { passive: true });
    window.addEventListener('pointerdown', interrupt);
    window.addEventListener('keydown', keyInterrupt);
    const cancelled = () => interrupted || generation !== locateGeneration || conversation() !== message.conversationId;
    const target = () => Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]')).find(el => el.dataset.messageId === message.messageId);
    const scrollRoot = () => {
      const anchor = target() ?? document.querySelector<HTMLElement>('[data-message-id]');
      if (!anchor) return null;
      for (let parent = anchor?.parentElement; parent; parent = parent.parentElement) {
        if (parent.clientHeight > 0 && parent.scrollHeight > parent.clientHeight + 2 && /auto|scroll|overlay/.test(getComputedStyle(parent).overflowY)) return parent;
      }
      const root = document.scrollingElement;
      return root instanceof HTMLElement && root.clientHeight > 0 ? root : null;
    };
    const wait = () => new Promise<void>(resolve => setTimeout(resolve, 200));
    const run = async () => {
      const result = await locateMessage({
        cancelled, now: () => Date.now(), wait,
        find: () => !!target(),
        viewport: () => {
          const root = scrollRoot();
          return root ? { top: root.scrollTop, height: root.clientHeight, extent: root.scrollHeight, signature: Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]')).map(el => el.dataset.messageId).join('|') } : null;
        },
        scroll: top => { if (!cancelled()) scrollRoot()?.scrollTo({ top, behavior: 'instant' as ScrollBehavior }); },
        reveal: async () => {
          const found = target(); if (!found || cancelled()) return false;
          found.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await wait();
          const mounted = target(); if (!mounted || cancelled()) return false;
          const bounds = mounted.getBoundingClientRect(); const root = scrollRoot(); const viewport = root?.getBoundingClientRect();
          if (bounds.bottom <= Math.max(0, viewport?.top ?? 0) || bounds.top >= Math.min(innerHeight, viewport?.bottom ?? innerHeight)) return false;
          const outline = mounted.style.outline; mounted.style.outline = '3px solid #218058'; setTimeout(() => { mounted.style.outline = outline; }, 2500);
          return true;
        },
      });
      const currentTarget = target();
      respond({ ...result, changed: result.found && currentTarget ? snapshot(currentTarget)?.text !== message.text : undefined });
    };
    void run().catch(() => respond({ found: false, reason: 'unavailable' })).finally(() => {
      window.removeEventListener('wheel', interrupt); window.removeEventListener('touchstart', interrupt);
      window.removeEventListener('pointerdown', interrupt); window.removeEventListener('keydown', keyInterrupt);
    });
    return true;
  });
})();
