import { expect, it } from 'vitest';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage, type GuideRailStorage } from '../src/storage/schema';
import { validateBackup, serializeBackup, parseBackup } from '../src/storage/backup';
import { parseOutline } from '../src/domain/outline';
import { getGuidance } from '../src/domain/guidance';
function fixture() {
  let data = applyCommand(emptyStorage(), { type: 'createProject', name: 'TTS', conversation: { conversationId: 'chat', pageUrl: 'https://chatgpt.com/c/chat' } });
  const planId = Object.keys(data.plans)[0];
  data = applyCommand(data, { type: 'importMarkdown', planId, source: '- [ ] 检查环境\n- [ ] 下载模型' });
  data = applyCommand(data, { type: 'createPhase', planId, title: '效果验证' });
  const [a, b] = data.plans[planId].stepIds; const [first, second] = data.plans[planId].phaseIds;
  data = applyCommand(data, { type: 'setStatus', id: a, status: 'current' });
  data = applyCommand(data, { type: 'captureMessage', planId, stepId: a, capture: { conversationId: 'chat', messageId: 'm', role: 'assistant', pageUrl: 'https://chatgpt.com/c/chat', text: '检查建议' } });
  return { data, planId, a, b, first, second };
}
it('moves current steps across phases while preserving references and progress', () => {
  const { data, planId, a, b, second } = fixture();
  const next = applyCommand(data, { type: 'assignPhase', stepId: a, phaseId: second });
  expect(next.plans[planId].stepIds).toEqual([b, a]); expect(next.steps[a].status).toBe('current');
  expect(next.sourceLinks).toEqual(data.sourceLinks); expect(next.conversationBindings).toEqual(data.conversationBindings);
  expect(parseBackup(serializeBackup(next))).toEqual(next);
});
it('reorders whole phases and uses their order for execution', () => {
  const f = fixture(); let next = applyCommand(f.data, { type: 'assignPhase', stepId: f.b, phaseId: f.second });
  next = applyCommand(next, { type: 'movePhase', id: f.second, direction: -1 });
  expect(next.plans[f.planId].stepIds).toEqual([f.b, f.a]);
  expect(getGuidance(next, next.plans[f.planId])).toMatchObject({ current: { id: f.a }, next: { id: f.b }, returning: true });
  expect(validateBackup(next)).toEqual(next);
  next = applyCommand(next, { type: 'completeAndAdvance', id: f.a, expectedNextStepId: f.b, acknowledgeIssues: false });
  expect(next.steps[f.b].status).toBe('current');
});
it('rejects foreign phases and deleting occupied or last phases', () => {
  const f = fixture(); const next = applyCommand(f.data, { type: 'createProject', name: 'Other' });
  const foreign = Object.values(next.phases).find(phase => phase.planId !== f.planId)!;
  expect(() => applyCommand(next, { type: 'assignPhase', stepId: f.a, phaseId: foreign.id })).toThrow('Wrong plan');
  expect(() => applyCommand(next, { type: 'createStep', planId: f.planId, phaseId: foreign.id, key: 'X', title: 'X' })).toThrow();
  expect(() => applyCommand(next, { type: 'deletePhase', id: f.first })).toThrow();
  const removed = applyCommand(next, { type: 'deletePhase', id: f.second }); expect(removed.phases[f.second]).toBeUndefined();
  expect(() => applyCommand(removed, { type: 'deletePhase', id: foreign.id })).toThrow();
});
it('keeps manual step movement inside its phase and inserts into the chosen phase', () => {
  const f = fixture(); let next = applyCommand(f.data, { type: 'assignPhase', stepId: f.b, phaseId: f.second });
  next = applyCommand(next, { type: 'moveStep', id: f.a, direction: 1 }); expect(next.plans[f.planId].stepIds).toEqual([f.a, f.b]);
  next = applyCommand(next, { type: 'createStep', planId: f.planId, phaseId: f.first, key: 'NEW', title: '检查输出' });
  expect(next.plans[f.planId].stepIds.at(-1)).toBe(f.b); expect(validateBackup(next)).toEqual(next);
});
it('migrates genuine v2 records preserving IDs, sources, notes and bindings', () => {
  const f = fixture(); const legacy = JSON.parse(JSON.stringify(f.data)); legacy.version = 2; delete legacy.phases;
  for (const plan of Object.values(legacy.plans) as any[]) delete plan.phaseIds;
  for (const step of Object.values(legacy.steps) as any[]) delete step.phaseId;
  const original = structuredClone(legacy); const next = validateBackup(legacy);
  expect(legacy).toEqual(original); expect(next.sources).toEqual(f.data.sources); expect(next.sourceLinks).toEqual(f.data.sourceLinks); expect(next.conversationBindings).toEqual(f.data.conversationBindings);
  expect(next.plans[f.planId].stepIds).toEqual([f.a, f.b]);
  expect(next.steps[f.a]).toMatchObject({ id: f.a, status: 'current' }); expect(next.steps[f.a].phaseId).toBe(next.steps[f.b].phaseId);
  expect(validateBackup(legacy)).toEqual(next); expect(validateBackup(next)).toEqual(next);
});
it('rejects broken phase references and interleaved phase order in backups', () => {
  const f = fixture(); const corruptions: ((data: GuideRailStorage) => void)[] = [
    data => { data.steps[f.a].phaseId = 'missing'; }, data => { data.plans[f.planId].phaseIds = []; },
    data => { data.phases[f.first].planId = 'missing'; }, data => { data.plans[f.planId].phaseIds.push(f.first); },
    data => { data.steps[f.a].phaseId = f.second; },
  ];
  for (const corrupt of corruptions) { const next = structuredClone(f.data); corrupt(next); expect(() => validateBackup(next)).toThrow(); }
});
const outline = '总目标：完成部署\n目标完成条件：生成 WAV\n未确认：风格选择\n## 环境\n1. 检查工具\n完成标准：显示版本\n```bash\n1. not a step\n```\n## 验证\n- [x] STEP-01 测试音频\n### 步骤 3：比较音质';
it('previews headings, numbering, checklists and code without inventing actions', () => {
  const result = parseOutline(outline); expect(result.goal).toBe('完成部署'); expect(result.unassigned).toContain('风格选择');
  expect(result.phases.map(phase => phase.steps.length)).toEqual([1, 2]);
  expect(result.phases[0].steps[0]).toMatchObject({ key: 'STEP-02', completionCriteria: '显示版本', commands: '1. not a step' });
  expect(result.phases[1].steps[0].status).toBe('done');
});
it('keeps nested lists as instructions and refuses incomplete or ambiguous input', () => {
  const result = parseOutline('第一阶段：下载\n1. 下载模型\n  - [ ] 检查日志\n第二阶段：验证\n2. 测试');
  expect(result.phases.map(phase => phase.steps.length)).toEqual([1, 1]); expect(result.phases[0].steps[0].instructions).toContain('检查日志');
  expect(() => parseOutline('建议先考虑模型再说')).toThrow(); expect(() => parseOutline('1. 下载\n```\nx')).toThrow('闭合');
});
it('imports atomically, preserving existing goal unless explicitly selected', () => {
  const f = fixture(); const data = applyCommand(f.data, { type: 'editGoal', planId: f.planId, goal: '原目标', completionCriteria: '原标准' });
  const source = outline.replace('STEP-01 ', '');
  const next = applyCommand(data, { type: 'importOutline', planId: f.planId, source, applyGoal: false });
  expect(next.plans[f.planId].goal).toBe('原目标'); expect(next.steps[f.a]).toEqual(data.steps[f.a]); expect(next.sourceLinks).toEqual(data.sourceLinks);
  expect(next.plans[f.planId].markdownSource).toContain(source); expect(validateBackup(next)).toEqual(next);
  const replaced = applyCommand(data, { type: 'importOutline', planId: f.planId, source, applyGoal: true }); expect(replaced.plans[f.planId].goal).toBe('完成部署');
  expect(() => applyCommand(data, { type: 'importOutline', planId: f.planId, source: outline, applyGoal: true })).toThrow('已存在');
});

it('appends moved steps to the destination in user action order', () => {
  const f = fixture(); let next = applyCommand(f.data, { type: 'assignPhase', stepId: f.a, phaseId: f.second });
  next = applyCommand(next, { type: 'assignPhase', stepId: f.b, phaseId: f.second });
  expect(next.plans[f.planId].stepIds).toEqual([f.a, f.b]);
  expect(applyCommand(next, { type: 'assignPhase', stepId: f.a, phaseId: f.second })).toEqual(next);
});
