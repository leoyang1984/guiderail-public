import { afterEach, expect, it, vi } from 'vitest';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage, type GuideRailStorage } from '../src/storage/schema';
import { parseBackup, serializeBackup, validateBackup } from '../src/storage/backup';
import { ChromeStorageRepository, createDispatcher } from '../src/storage/storage';
function fixture() {
  let data = applyCommand(emptyStorage(), { type: 'createProject', name: 'TTS', conversation: { conversationId: 'abc', pageUrl: 'https://chatgpt.com/c/abc' } });
  const projectId = data.selectedProjectId!; const planId = data.projects[projectId].activePlanId!;
  data = applyCommand(data, { type: 'importMarkdown', planId, source: '- [x] STEP-01 Environment\n- [ ] STEP-02 Generate' });
  const [first, second] = data.plans[planId].stepIds;
  data = applyCommand(data, { type: 'setStatus', id: second, status: 'current' });
  data = applyCommand(data, { type: 'createThread', stepId: second, title: 'Proxy', description: 'Details', pageUrl: 'https://chatgpt.com/c/abc' });
  const issue = data.steps[second].threadIds[0];
  data = applyCommand(data, { type: 'resolveThread', id: issue, resolved: true });
  return { data, first, second, issue, projectId, planId };
}
it('round-trips all data including current step, solved issues and source', () => {
  const { data } = fixture(); expect(parseBackup(serializeBackup(data))).toEqual(data);
  expect(parseBackup(serializeBackup(emptyStorage()))).toEqual(emptyStorage());
});
it('rejects malformed JSON, wrong versions and unsafe record IDs', () => {
  for (const text of ['{', 'null', '[]', '{}', JSON.stringify({ ...emptyStorage(), version: 99 }), '{"version":1,"projects":{"__proto__":{}}}']) expect(() => parseBackup(text)).toThrow();
});
it('rejects malformed fields and broken references', () => {
  const f = fixture();
  const corruptions: ((data: GuideRailStorage) => void)[] = [
    d => { d.projects[f.projectId].name = ''; },
    d => { d.projects[f.projectId].updatedAt = 'yesterday'; },
    d => { d.projects[f.projectId].activePlanId = 'missing'; },
    d => { d.plans[f.planId].stepIds.push(f.first); },
    d => { d.plans[f.planId].stepIds = [f.first]; },
    d => { d.steps[f.first].order = 9; },
    d => { d.steps[f.first].title = 42 as unknown as string; },
    d => { d.steps[f.first].key = 'STEP-02'; },
    d => { d.steps[f.first].status = 'current'; },
    d => { d.steps[f.first].threadIds = [f.issue]; },
    d => { delete d.threads[f.issue]; },
    d => { d.threads[f.issue].pageUrl = 'javascript:alert(1)'; },
    d => { d.threads[f.issue].resolved = 'true' as unknown as boolean; },
    d => { d.conversationBindings.abc.currentStepId = f.first; },
    d => { d.conversationBindings.abc.pageUrl = 'https://chatgpt.com/c/wrong'; },
    d => { d.selectedProjectId = 'missing'; },
  ];
  for (const corrupt of corruptions) { const data = structuredClone(f.data); corrupt(data); expect(() => validateBackup(data)).toThrow(); }
});
it('validates then replaces, preserving original backup timestamps', () => {
  const { data: backup } = fixture(); const current = applyCommand(emptyStorage(), { type: 'createProject', name: 'Replace me' });
  const result = applyCommand(current, { type: 'restoreBackup', data: backup, expectedSource: JSON.stringify(current) });
  expect(result).toEqual(backup); expect(result).not.toBe(backup);
  expect(Object.values(current.projects)[0].name).toBe('Replace me');
});
it('rejects stale confirmation and invalid backup without changing live data', () => {
  const current = emptyStorage(); const newer = applyCommand(current, { type: 'createProject', name: 'New work' });
  expect(() => applyCommand(newer, { type: 'restoreBackup', data: emptyStorage(), expectedSource: JSON.stringify(current) })).toThrow('Data changed');
  expect(() => applyCommand(newer, { type: 'restoreBackup', data: {}, expectedSource: JSON.stringify(newer) })).toThrow();
  expect(Object.values(newer.projects)[0].name).toBe('New work');
});
afterEach(() => vi.unstubAllGlobals());
it('persists restoration through the serialized writer and retains disk on write failure', async () => {
  let disk = emptyStorage(); const set = vi.fn(async (value: { guiderail: GuideRailStorage }) => { disk = structuredClone(value.guiderail); });
  vi.stubGlobal('chrome', { storage: { local: { get: async () => ({ guiderail: structuredClone(disk) }), set } } });
  const dispatch = createDispatcher(new ChromeStorageRepository()); const { data } = fixture();
  set.mockRejectedValueOnce(new Error('Quota'));
  await expect(dispatch({ type: 'restoreBackup', data, expectedSource: JSON.stringify(disk) })).rejects.toThrow('Quota');
  expect(disk).toEqual(emptyStorage());
  await dispatch({ type: 'restoreBackup', data, expectedSource: JSON.stringify(disk) });
  expect(await new ChromeStorageRepository().read()).toEqual(data);
});
it('rejects oversized backups before parsing', () => {
  expect(() => parseBackup('x'.repeat(5 * 1024 * 1024 + 1))).toThrow();
});
