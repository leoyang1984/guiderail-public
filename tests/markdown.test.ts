import { expect, it } from 'vitest';
import { parseChecklist } from '../src/domain/markdown';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage } from '../src/storage/schema';

it('parses checklist status, explicit keys and CRLF while preserving titles', () => {
  expect(parseChecklist('# Plan\r\n- [x] STEP-01 Install tools\r\n- [ ] STEP-02 配置环境\r\nExplanation')).toEqual([
    { key: 'STEP-01', title: 'Install tools', status: 'done' }, { key: 'STEP-02', title: '配置环境', status: 'todo', instructions: 'Explanation' },
  ]);
});
it('assigns keys without collisions with existing and later explicit keys', () => {
  expect(parseChecklist('- [ ] Unnumbered\n- [X] STEP-02 Explicit', ['STEP-01']).map(step => step.key)).toEqual(['STEP-03', 'STEP-02']);
});
it('rejects empty input, oversized input and duplicate explicit keys', () => {
  for (const source of ['', '# Heading', '- ordinary list', '- [x] STEP-01 A\n- [ ] step-01 B', 'x'.repeat(200001), '- [ ] ' + 'x'.repeat(241)]) expect(() => parseChecklist(source)).toThrow();
  expect(() => parseChecklist('- [ ] STEP-01 Existing', ['step-01'])).toThrow('已存在');
});
it('imports the ten-step acceptance plan preserving seven completed steps', () => {
  const source = Array.from({ length: 10 }, (_, i) => `- [${i < 7 ? 'x' : ' '}] STEP-${String(i + 1).padStart(2, '0')} Task ${i + 1}`).join('\n');
  let data = applyCommand(emptyStorage(), { type: 'createProject', name: 'TTS' });
  const planId = data.projects[data.selectedProjectId!].activePlanId!;
  data = applyCommand(data, { type: 'importMarkdown', planId, source });
  expect(data.plans[planId].stepIds).toHaveLength(10);
  expect(Object.values(data.steps).filter(step => step.status === 'done')).toHaveLength(7);
  expect(data.plans[planId].markdownSource).toBe(source);
});
it('appends atomically without overwriting current steps or issues', () => {
  let data = applyCommand(emptyStorage(), { type: 'createProject', name: 'TTS' });
  const planId = data.projects[data.selectedProjectId!].activePlanId!;
  data = applyCommand(data, { type: 'createStep', planId, key: 'STEP-01', title: 'Original' });
  const stepId = data.plans[planId].stepIds[0];
  data = applyCommand(data, { type: 'setStatus', id: stepId, status: 'current' });
  data = applyCommand(data, { type: 'createThread', stepId, title: 'Keep issue', description: '' });
  const before = structuredClone(data);
  expect(() => applyCommand(data, { type: 'importMarkdown', planId, source: '- [ ] STEP-02 New\n- [ ] STEP-01 Duplicate' })).toThrow();
  expect(data).toEqual(before);
  const source = '# Plan\n- [ ] STEP-02 New\nDetails retained';
  data = applyCommand(data, { type: 'importMarkdown', planId, source });
  expect(data.steps[stepId]).toEqual(before.steps[stepId]);
  expect(data.threads).toEqual(before.threads);
  expect(data.plans[planId].stepIds.map(id => data.steps[id].order)).toEqual([0, 1]);
  expect(data.plans[planId].markdownSource).toBe(source);
});
it('imports step instructions, fenced commands and labeled completion criteria', () => {
  const source = '- [ ] STEP-01 环境\n操作说明：打开终端\n```sh\npython3 --version\n- [ ] this is command text\n```\n完成标准：显示版本号\n- [ ] STEP-02 下一步\n命令行中的文字仍是说明';
  expect(parseChecklist(source)).toEqual([
    { key: 'STEP-01', title: '环境', status: 'todo', instructions: '打开终端', commands: 'python3 --version\n- [ ] this is command text', completionCriteria: '显示版本号' },
    { key: 'STEP-02', title: '下一步', status: 'todo', instructions: '命令行中的文字仍是说明' },
  ]);
});
it('accepts Markdown wrappers and rejects oversized per-step detail', () => {
  expect(parseChecklist('```markdown\n- [ ] STEP-01 A\n操作说明：Details\n命令：echo hello\n完成标准：hello\n```')[0]).toMatchObject({ instructions: 'Details', commands: 'echo hello', completionCriteria: 'hello' });
  expect(parseChecklist('```\n- [ ] STEP-01 A\n```')).toHaveLength(1);
  expect(() => parseChecklist('- [ ] STEP-01 A\n' + 'x'.repeat(10001))).toThrow();
});
