// Development-only UI harness. Not an extension build entry; no user storage is used.
import { createRoot } from 'react-dom/client';
import { App } from '../src/sidepanel/App';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage } from '../src/storage/schema';
import { createDispatcher } from '../src/storage/storage';
import '../src/sidepanel/style.css';
function event() {
  const listeners = new Set<(...args: unknown[]) => void>();
  return { addListener: (listener: (...args: unknown[]) => void) => listeners.add(listener), removeListener: (listener: (...args: unknown[]) => void) => listeners.delete(listener), emit: (...args: unknown[]) => listeners.forEach(listener => listener(...args)) };
}
let data = applyCommand(emptyStorage(), { type: 'createProject', name: 'Local TTS Server', conversation: { conversationId: 'preview', pageUrl: 'https://chatgpt.com/c/preview' } });
const planId = data.projects[data.selectedProjectId!].activePlanId!;
data = applyCommand(data, { type: 'importMarkdown', planId, source: Array.from({ length: 10 }, (_, i) => `- [${i < 7 ? 'x' : ' '}] STEP-${String(i + 1).padStart(2, '0')} ${['检查环境', '安装工具', '创建目录', '创建 Python 环境', '安装 MLX-Audio', '创建启动脚本', '启动 API 服务', '生成第一个 WAV', '测试声音', '配置开机启动'][i]}\n操作说明：在终端中执行对应操作，检查输出结果。\n命令：python3 --version\n完成标准：命令执行成功，输出符合预期。`).join('\n') });
const stepId = data.plans[planId].stepIds[7];
data = applyCommand(data, { type: 'setStatus', id: stepId, status: 'current' });
data = applyCommand(data, { type: 'editGoal', planId, goal: '完成本地 TTS 部署并生成可播放音频', completionCriteria: '生成 WAV 并试听，确认内容和音色符合预期。' });
data = applyCommand(data, { type: 'renamePhase', id: data.plans[planId].phaseIds[0], title: '环境与服务' });
data = applyCommand(data, { type: 'createPhase', planId, title: '音频验证' });
for (const id of data.plans[planId].stepIds.slice(7)) data = applyCommand(data, { type: 'assignPhase', stepId: id, phaseId: data.plans[planId].phaseIds[1] });
const changed = event();
const dispatch = createDispatcher({ read: async () => structuredClone(data), write: async next => { data = structuredClone(next); changed.emit({ guiderail: { newValue: data } }, 'local'); } });
const api = {
  windows: { getCurrent: async () => ({ id: 1 }) },
  tabs: { query: async () => [{ url: 'https://chatgpt.com/c/preview' }], onActivated: event(), onUpdated: event(), onReplaced: event() },
  storage: { local: { get: async () => ({ guiderail: structuredClone(data) }) }, onChanged: changed },
  runtime: { sendMessage: async (message: { command: Parameters<typeof dispatch>[0] }) => { await dispatch(message.command); return { ok: true }; } },
};
Object.defineProperty(globalThis, 'chrome', { configurable: true, value: api });
createRoot(document.getElementById('root')!).render(<App />);
