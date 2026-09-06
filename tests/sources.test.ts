import { expect, it, vi, afterEach } from 'vitest';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage, type Capture } from '../src/storage/schema';
import { validateBackup, parseBackup, serializeBackup } from '../src/storage/backup';
import { ChromeStorageRepository, createDispatcher } from '../src/storage/storage';
import { openSource } from '../src/sidepanel/open-source';
const capture: Capture = { conversationId: 'chat1', messageId: 'message1', role: 'assistant', pageUrl: 'https://chatgpt.com/c/chat1', text: '下载模型\n```\ncommand\n```' };
function fixture() {
  const data = applyCommand(emptyStorage(), { type: 'createProject', name: 'Test' });
  return { data, planId: Object.keys(data.plans)[0] };
}
it('atomically creates a step and captures a source without changing progress', () => {
  const { data, planId } = fixture(); const result = applyCommand(data, { type: 'captureMessage', capture, planId, title: '下载' });
  expect(Object.values(result.steps)[0]).toMatchObject({ title: '下载', status: 'todo' });
  expect(Object.values(result.sources)[0].text).toBe(capture.text);
  expect(Object.keys(data.steps)).toHaveLength(0);
  expect(parseBackup(serializeBackup(result))).toEqual(result);
});
it('deduplicates associations and shares a source across steps', () => {
  const { data, planId } = fixture(); let next = applyCommand(data, { type: 'captureMessage', capture, planId, title: 'One' });
  const stepId = Object.keys(next.steps)[0]; next = applyCommand(next, { type: 'captureMessage', capture, planId, stepId });
  expect(Object.keys(next.sourceLinks)).toHaveLength(1);
  next = applyCommand(next, { type: 'captureMessage', capture, planId, title: 'Two' });
  expect(Object.keys(next.sourceLinks)).toHaveLength(2); expect(Object.keys(next.sources)).toHaveLength(1);
  const link = Object.values(next.sourceLinks).find(item => item.stepId === stepId)!;
  next = applyCommand(next, { type: 'unlinkSource', id: link.id }); expect(Object.keys(next.sources)).toHaveLength(1);
  next = applyCommand(next, { type: 'deleteStep', id: Object.keys(next.steps).find(id => id !== stepId)! });
  expect(Object.keys(next.sources)).toHaveLength(0); expect(Object.keys(next.sourceLinks)).toHaveLength(0);
});
it('requires explicit replacement when a captured reply changes', () => {
  const { data, planId } = fixture(); const next = applyCommand(data, { type: 'captureMessage', capture, planId, title: 'One' });
  const command = { type: 'captureMessage' as const, capture: { ...capture, text: 'Changed' }, planId, stepId: Object.keys(next.steps)[0] };
  expect(() => applyCommand(next, command)).toThrow('confirmation');
  expect(Object.values(next.sources)[0].text).toBe(capture.text);
  expect(Object.values(applyCommand(next, { ...command, replaceSnapshot: true }).sources)[0].text).toBe('Changed');
});
it('rejects invalid references, unsafe sources, malformed snapshots and categories atomically', () => {
  const { data, planId } = fixture();
  for (const patch of [{ messageId: '__proto__' }, { pageUrl: 'https://evil.test/c/chat1' }, { text: '' }, { text: 'x'.repeat(200001) }]) {
    expect(() => applyCommand(data, { type: 'captureMessage', capture: { ...capture, ...patch }, planId, title: 'No' })).toThrow();
  }
  const next = applyCommand(data, { type: 'captureMessage', capture, planId, title: 'One' });
  const other = applyCommand(next, { type: 'createProject', name: 'Other' });
  expect(() => applyCommand(other, { type: 'captureMessage', capture, planId: Object.keys(other.plans).find(id => id !== planId)!, stepId: Object.keys(next.steps)[0] })).toThrow('Wrong plan');
  const broken = structuredClone(next); Object.values(broken.sourceLinks)[0].sourceId = 'missing'; expect(() => validateBackup(broken)).toThrow();
  expect(Object.keys(data.steps)).toHaveLength(0);
});
it('migrates v1 without writing on read and preserves disk on failed first upgraded write', async () => {
  const { data } = fixture(); const { sources: _sources, sourceLinks: _links, ...base } = data;
  let disk = { ...base, version: 1 }; const original = structuredClone(disk);
  const set = vi.fn(async (value: any) => { disk = structuredClone(value.guiderail); });
  vi.stubGlobal('chrome', { storage: { local: { get: async () => ({ guiderail: disk }), set } } });
  const repository = new ChromeStorageRepository(); expect(await repository.read()).toMatchObject({ version: 3, sources: {}, sourceLinks: {} }); expect(set).not.toHaveBeenCalled();
  expect(validateBackup(original).projects).toEqual(data.projects);
  set.mockRejectedValueOnce(new Error('Quota')); await expect(createDispatcher(repository)({ type: 'createProject', name: 'Fail' })).rejects.toThrow('Quota'); expect(disk).toEqual(original);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('reuses the correct conversation and reports changed content', async () => {
  const sendMessage = vi.fn(async (_tabId: number, _message: unknown) => ({ found: true, changed: true })); const update = vi.fn();
  vi.stubGlobal('chrome', { tabs: { query: async () => [{ id: 1, url: 'https://chatgpt.com/c/other' }, { id: 2, windowId: 3, url: capture.pageUrl }], update, sendMessage }, windows: { update: vi.fn() } });
  expect(await openSource({ ...capture, id: 's', createdAt: '', updatedAt: '' })).toContain('不同');
  expect(update).toHaveBeenCalledWith(2, { active: true }); expect(sendMessage.mock.calls[0][0]).toBe(2);
});
it('bounds lookup retries and keeps a snapshot fallback for missing history', async () => {
  vi.useFakeTimers(); const sendMessage = vi.fn(async () => ({ found: false }));
  vi.stubGlobal('chrome', { tabs: { query: async () => [], create: async () => ({ id: 4 }), sendMessage } });
  const operation = openSource({ ...capture, id: 's', createdAt: '', updatedAt: '' }); await vi.runAllTimersAsync();
  expect(await operation).toContain('快照'); expect(sendMessage).toHaveBeenCalledTimes(1);
});
