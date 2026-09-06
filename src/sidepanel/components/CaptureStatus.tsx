import { useEffect, useState } from 'react';
export function CaptureStatus() {
  const [status, setStatus] = useState({ text: '正在检查收藏入口…', routine: false });
  useEffect(() => {
    let active = true;
    const check = async () => {
      let text: string;
      let routine = false;
      try {
        const window = await chrome.windows.getCurrent();
        const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
        const result = await chrome.tabs.sendMessage(tab.id!, { kind: 'guiderail:status' });
        routine = !!result?.available && !result.streaming;
        text = result?.available ? result.streaming ? '回复生成中，完成后可收藏。' : '在长回复末尾点击“☆ 收藏这条回复”。' : '尚未识别消息结构。请等待加载或刷新；已有收藏仍可阅读。';
      } catch { text = '收藏入口尚未连接。更新扩展后，请刷新 ChatGPT 页面。'; }
      if (active) setStatus({ text, routine });
    };
    void check(); const timer = setInterval(() => { void check(); }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return <p className="muted capture-note" data-routine={status.routine} role="status">{status.text}</p>;
}
