import { expect, it, afterEach, vi } from 'vitest';
import { applyCommand } from '../src/domain/plan';
import { resolveConversation } from '../src/domain/conversation';
import { emptyStorage, type Command } from '../src/storage/schema';
import { ChromeStorageRepository, createDispatcher } from '../src/storage/storage';

function setup() {
  let data = emptyStorage();
  const run = (command: Command) => { data = applyCommand(data, command); };
  run({ type: 'createProject', name: 'A', conversation: { conversationId: 'a', pageUrl: 'https://chatgpt.com/c/a' } });
  const projectA = data.selectedProjectId!; const planA = data.projects[projectA].activePlanId!;
  run({ type: 'createStep', planId: planA, key: '01', title: 'First' });
  run({ type: 'createStep', planId: planA, key: '02', title: 'Second' });
  const [first, second] = data.plans[planA].stepIds;
  return { run, projectA, planA, first, second, get data() { return data; } };
}

it('creates project, plan and conversation binding together', () => {
  const f = setup();
  expect(f.data.conversationBindings.a).toMatchObject({ projectId: f.projectA, planId: f.planA, conversationId: 'a', pageUrl: 'https://chatgpt.com/c/a' });
  expect(() => f.run({ type: 'createProject', name: 'Bad', conversation: { conversationId: 'bad', pageUrl: 'https://example.com/c/bad' } })).toThrow();
  expect(Object.keys(f.data.projects)).toHaveLength(1);
});
it('restores independent projects and current steps on conversation switches without writes', () => {
  const f = setup(); f.run({ type: 'setStatus', id: f.first, status: 'current' });
  f.run({ type: 'createProject', name: 'B', conversation: { conversationId: 'b', pageUrl: 'https://chatgpt.com/c/b' } });
  const projectB = f.data.selectedProjectId!; const planB = f.data.projects[projectB].activePlanId!;
  f.run({ type: 'createStep', planId: planB, key: 'B1', title: 'Other' });
  const other = f.data.plans[planB].stepIds[0]; f.run({ type: 'setStatus', id: other, status: 'current' });
  const before = structuredClone(f.data);
  for (const conversation of ['a', 'b', 'a']) {
    const resolved = resolveConversation(f.data, conversation);
    expect(resolved.project?.id).toBe(conversation === 'a' ? f.projectA : projectB);
    expect(resolved.currentStepId).toBe(conversation === 'a' ? f.first : other);
  }
  expect(f.data).toEqual(before);
});
it('shares one plan current step across bindings and clears it when completed or deleted', () => {
  const f = setup(); f.run({ type: 'setStatus', id: f.first, status: 'current' });
  f.run({ type: 'bindConversation', conversationId: 'a2', pageUrl: 'https://chatgpt.com/c/a2', projectId: f.projectA, planId: f.planA });
  expect(f.data.conversationBindings.a2.currentStepId).toBe(f.first);
  f.run({ type: 'setStatus', id: f.second, status: 'current' });
  for (const key of ['a', 'a2']) expect(f.data.conversationBindings[key].currentStepId).toBe(f.second);
  expect(f.data.steps[f.first].status).toBe('todo');
  f.run({ type: 'setStatus', id: f.second, status: 'done' });
  for (const key of ['a', 'a2']) expect(f.data.conversationBindings[key].currentStepId).toBeUndefined();
  f.run({ type: 'setStatus', id: f.first, status: 'current' });
  f.run({ type: 'deleteStep', id: f.first });
  for (const key of ['a', 'a2']) expect(resolveConversation(f.data, key).currentStepId).toBeUndefined();
});
it('rebinds a conversation without deleting its previous project or steps', () => {
  const f = setup(); const createdAt = f.data.conversationBindings.a.createdAt;
  f.run({ type: 'createProject', name: 'B' });
  const projectId = f.data.selectedProjectId!; const planId = f.data.projects[projectId].activePlanId!;
  f.run({ type: 'bindConversation', conversationId: 'a', pageUrl: 'https://chatgpt.com/c/a', projectId, planId });
  expect(resolveConversation(f.data, 'a').project?.id).toBe(projectId);
  expect(f.data.steps[f.first]).toBeDefined();
  expect(f.data.conversationBindings.a.createdAt).toBe(createdAt);
});
it('rejects mismatched URLs, missing projects and cross-project plans atomically', () => {
  const f = setup(); const before = structuredClone(f.data);
  for (const changes of [
    { pageUrl: 'https://chatgpt.com/c/wrong' }, { pageUrl: 'https://example.com/c/a' },
    { projectId: 'missing' }, { planId: 'missing' },
  ]) expect(() => f.run({ type: 'bindConversation', conversationId: 'a', pageUrl: 'https://chatgpt.com/c/a', projectId: f.projectA, planId: f.planA, ...changes })).toThrow();
  expect(f.data).toEqual(before);
  f.run({ type: 'createProject', name: 'B' });
  expect(() => f.run({ type: 'bindConversation', conversationId: 'a', pageUrl: 'https://chatgpt.com/c/a', projectId: f.data.selectedProjectId!, planId: f.planA })).toThrow();
});
it('leaves new conversations unbound and resolves existing plans without requiring binding step IDs', () => {
  const f = setup(); f.run({ type: 'setStatus', id: f.first, status: 'current' });
  delete f.data.conversationBindings.a.currentStepId;
  expect(resolveConversation(f.data, 'a').currentStepId).toBe(f.first);
  expect(resolveConversation(f.data, 'new').binding).toBeUndefined();
  expect(resolveConversation(f.data, null).binding).toBeUndefined();
  expect(f.data.conversationBindings.new).toBeUndefined();
});
afterEach(() => vi.unstubAllGlobals());
it('restores a saved binding from a fresh repository after closing the panel', async () => {
  const f = setup(); let disk = structuredClone(f.data);
  vi.stubGlobal('chrome', { storage: { local: {
    get: async () => ({ guiderail: structuredClone(disk) }),
    set: async (value: { guiderail: typeof disk }) => { disk = structuredClone(value.guiderail); },
  } } });
  await createDispatcher(new ChromeStorageRepository())({ type: 'setStatus', id: f.second, status: 'current' });
  const restored = await new ChromeStorageRepository().read();
  expect(resolveConversation(restored, 'a')).toMatchObject({ project: { id: f.projectA }, plan: { id: f.planA }, currentStepId: f.second });
  expect(restored.conversationBindings.a.currentStepId).toBe(f.second);
});
