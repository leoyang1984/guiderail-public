import { afterEach, expect, it, vi } from 'vitest';
import { applyCommand } from '../src/domain/plan';
import { getThreadUrl, threadLink } from '../src/domain/thread';
import { emptyStorage, type Command } from '../src/storage/schema';
import { ChromeStorageRepository, createDispatcher } from '../src/storage/storage';
import { openThreadConversation } from '../src/sidepanel/open-conversation';

function fixture() {
  let data = emptyStorage();
  const run = (command: Command) => { data = applyCommand(data, command); };
  run({ type: 'createProject', name: 'TTS' });
  const projectId = data.selectedProjectId!; const planId = data.projects[projectId].activePlanId!;
  run({ type: 'createStep', planId, key: 'STEP-08', title: 'Generate WAV' });
  run({ type: 'createStep', planId, key: 'STEP-09', title: 'Test voice' });
  const [stepId, otherStep] = data.plans[planId].stepIds;
  run({ type: 'createThread', stepId, title: 'SOCKS proxy issue', description: 'Download failed', pageUrl: 'https://chatgpt.com/c/abc' });
  const issueId = data.steps[stepId].threadIds[0];
  return { run, projectId, planId, stepId, otherStep, issueId, get data() { return data; } };
}

afterEach(() => vi.unstubAllGlobals());
it('creates an issue under only its owning step with a conversation link', () => {
  const f = fixture();
  expect(f.data.threads[f.issueId]).toMatchObject({ stepId: f.stepId, conversationId: 'abc', pageUrl: 'https://chatgpt.com/c/abc', resolved: false });
  expect(f.data.steps[f.otherStep].threadIds).toEqual([]);
});
it('edits issues and removes optional links without changing status', () => {
  const f = fixture(); f.run({ type: 'resolveThread', id: f.issueId, resolved: true });
  f.run({ type: 'editThread', id: f.issueId, title: 'Updated', description: 'Fixed', pageUrl: 'https://chatgpt.com/c/other' });
  expect(f.data.threads[f.issueId]).toMatchObject({ title: 'Updated', description: 'Fixed', conversationId: 'other', resolved: true });
  f.run({ type: 'editThread', id: f.issueId, title: 'Updated', description: '', pageUrl: '' });
  expect(f.data.threads[f.issueId].conversationId).toBeUndefined();
  expect(f.data.threads[f.issueId].pageUrl).toBeUndefined();
  f.run({ type: 'resolveThread', id: f.issueId, resolved: false });
  expect(f.data.threads[f.issueId].resolved).toBe(false);
});
it('allows issues without a conversation and retains step progress when resolving', () => {
  const f = fixture(); f.run({ type: 'setStatus', id: f.stepId, status: 'blocked' });
  f.run({ type: 'createThread', stepId: f.otherStep, title: 'Offline note', description: '' });
  f.run({ type: 'resolveThread', id: f.issueId, resolved: true });
  expect(f.data.steps[f.stepId].status).toBe('blocked');
  expect(getThreadUrl(f.data.threads[f.data.steps[f.otherStep].threadIds[0]])).toBeNull();
});
it('deletes issues and cascading step issues without affecting other steps', () => {
  const f = fixture();
  f.run({ type: 'createThread', stepId: f.otherStep, title: 'Keep me', description: '' });
  const keep = f.data.steps[f.otherStep].threadIds[0];
  f.run({ type: 'deleteThread', id: f.issueId });
  expect(f.data.steps[f.stepId].threadIds).toEqual([]);
  expect(f.data.threads[f.issueId]).toBeUndefined();
  f.run({ type: 'createThread', stepId: f.stepId, title: 'Cascade', description: '' });
  const cascade = f.data.steps[f.stepId].threadIds[0];
  f.run({ type: 'deleteStep', id: f.stepId });
  expect(f.data.threads[cascade]).toBeUndefined();
  expect(f.data.threads[keep]).toBeDefined();
});
it('rejects invalid input and orphan issues without changing saved state', () => {
  const f = fixture(); const before = structuredClone(f.data);
  const bad: Command[] = [
    { type: 'createThread', stepId: 'missing', title: 'Issue', description: '' },
    { type: 'createThread', stepId: f.stepId, title: ' ', description: '' },
    { type: 'editThread', id: f.issueId, title: 'Bad', description: '', pageUrl: 'javascript:alert(1)' },
    { type: 'editThread', id: f.issueId, title: 'Bad', description: 'x'.repeat(10001) },
    { type: 'deleteThread', id: 'missing' },
    { type: 'resolveThread', id: f.issueId, resolved: 'yes' } as unknown as Command,
  ];
  for (const command of bad) expect(() => f.run(command)).toThrow();
  expect(f.data).toEqual(before);
});
it('updates parent timestamps when an issue changes', () => {
  const f = fixture(); const next = applyCommand(f.data, { type: 'resolveThread', id: f.issueId, resolved: true }, 'new-time');
  for (const object of [next.threads[f.issueId], next.steps[f.stepId], next.plans[f.planId], next.projects[f.projectId]]) expect(object.updatedAt).toBe('new-time');
});
it('restores resolved issues with links from a fresh repository', async () => {
  const f = fixture(); let disk = structuredClone(f.data);
  vi.stubGlobal('chrome', { storage: { local: {
    get: async () => ({ guiderail: structuredClone(disk) }),
    set: async (value: { guiderail: typeof disk }) => { disk = structuredClone(value.guiderail); },
  } } });
  await createDispatcher(new ChromeStorageRepository())({ type: 'resolveThread', id: f.issueId, resolved: true });
  const restored = await new ChromeStorageRepository().read();
  expect(restored.steps[f.stepId].threadIds).toContain(f.issueId);
  expect(restored.threads[f.issueId]).toMatchObject({ title: 'SOCKS proxy issue', resolved: true, conversationId: 'abc' });
});
it('validates deep links and supports older conversationId-only records', () => {
  expect(threadLink('  ')).toEqual({});
  expect(getThreadUrl({ conversationId: 'abc-123' })).toBe('https://chatgpt.com/c/abc-123');
  expect(getThreadUrl({ pageUrl: 'https://chatgpt.com/c/abc', conversationId: 'different' })).toBeNull();
  for (const url of ['https://evil.test/c/abc', 'https://chatgpt.com/', 'javascript:alert(1)']) {
    expect(() => threadLink(url)).toThrow(); expect(getThreadUrl({ pageUrl: url })).toBeNull();
  }
  expect(getThreadUrl({ conversationId: '../evil' })).toBeNull();
});
it('opens a valid issue in a new tab in the panel window and propagates failures', async () => {
  const create = vi.fn().mockResolvedValue({ id: 20 });
  vi.stubGlobal('chrome', { windows: { getCurrent: async () => ({ id: 7 }) }, tabs: { create } });
  await openThreadConversation({ conversationId: 'abc' });
  expect(create).toHaveBeenCalledWith({ url: 'https://chatgpt.com/c/abc', windowId: 7, active: true });
  await expect(openThreadConversation({ pageUrl: 'https://evil.test/' })).rejects.toThrow();
  expect(create).toHaveBeenCalledTimes(1);
  create.mockRejectedValueOnce(new Error('Cannot create tab'));
  await expect(openThreadConversation({ conversationId: 'abc' })).rejects.toThrow('Cannot create tab');
});
