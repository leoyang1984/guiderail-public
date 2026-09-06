import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Replies } from '../src/sidepanel/components/Replies';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage, type Command } from '../src/storage/schema';
import '../src/sidepanel/style.css';
history.replaceState(null, '', '/c/preview');
let data = applyCommand(emptyStorage(), { type: 'createProject', name: 'TTS 模拟' });
const planId = Object.keys(data.plans)[0];
data = applyCommand(data, { type: 'createStep', planId, key: 'STEP-01', title: '下载模型' });
const stepId = Object.keys(data.steps)[0]; data = applyCommand(data, { type: 'setStatus', id: stepId, status: 'current' });
let update = () => {};
let receive: (message: unknown, sender: unknown, respond: (result: unknown) => void) => void;
const run = async (command: Command) => { data = applyCommand(data, command); update(); return true; };
Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
  runtime: { onMessage: { addListener: (listener: typeof receive) => { receive = listener; } }, sendMessage: async (message: { kind: string; command: Command }) => { if (message.kind === 'guiderail:captureContext') return { ok: true, data: structuredClone(data) }; await run(message.command); return { ok: true }; } },
  tabs: { query: async () => [{ id: 1, windowId: 1, url: 'https://chatgpt.com/c/preview' }], update: async () => {}, sendMessage: async (_id: number, message: unknown) => new Promise(resolve => receive(message, {}, resolve)) },
  windows: { update: async () => {} },
} });
function Preview() { const [, refresh] = useState(0); update = () => refresh(n => n + 1); return <><Replies conversationId="preview" data={data} run={run} busy={false} /></>; }
createRoot(document.getElementById('root')!).render(<Preview />);
void import('../src/content/messages');
