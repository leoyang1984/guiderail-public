import { expect, it } from 'vitest';
import { getGuidance } from '../src/domain/guidance';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage, type Command } from '../src/storage/schema';
import { parseBackup, serializeBackup } from '../src/storage/backup';
function fixture() {
  let data = emptyStorage();
  const run = (command: Command) => { data = applyCommand(data, command); };
  run({ type: 'createProject', name: 'TTS', conversation: { conversationId: 'a', pageUrl: 'https://chatgpt.com/c/a' } });
  const projectId = data.selectedProjectId!; const planId = data.projects[projectId].activePlanId!;
  for (const key of ['01', '02', '03']) run({ type: 'createStep', planId, key, title: `Task ${key}` });
  const [a, b, c] = data.plans[planId].stepIds;
  run({ type: 'bindConversation', conversationId: 'b', pageUrl: 'https://chatgpt.com/c/b', projectId, planId });
  return { run, planId, a, b, c, get data() { return data; }, guide: () => getGuidance(data, data.plans[planId]) };
}
it('shows completion count, ordinal position and next action', () => {
  const f = fixture(); expect(f.guide()).toMatchObject({ total: 3, completed: 0, currentIndex: -1, next: { id: f.a } });
  f.run({ type: 'setStatus', id: f.a, status: 'done' }); f.run({ type: 'setStatus', id: f.b, status: 'current' });
  expect(f.guide()).toMatchObject({ completed: 1, currentIndex: 1, current: { id: f.b }, next: { id: f.c } });
});
it('advances in one mutation and synchronizes all conversation bindings', () => {
  const f = fixture(); f.run({ type: 'setStatus', id: f.a, status: 'current' });
  f.run({ type: 'completeAndAdvance', id: f.a, expectedNextStepId: f.b, acknowledgeIssues: false });
  expect(f.data.steps[f.a].status).toBe('done'); expect(f.data.steps[f.b].status).toBe('current');
  expect(f.data.conversationBindings.a.currentStepId).toBe(f.b); expect(f.data.conversationBindings.b.currentStepId).toBe(f.b);
});
it('skips done steps, completes the final step and clears current bindings', () => {
  const f = fixture(); f.run({ type: 'setStatus', id: f.b, status: 'done' });
  f.run({ type: 'setStatus', id: f.a, status: 'current' });
  f.run({ type: 'completeAndAdvance', id: f.a, expectedNextStepId: f.c, acknowledgeIssues: false });
  f.run({ type: 'completeAndAdvance', id: f.c, expectedNextStepId: null, acknowledgeIssues: false });
  expect(f.guide()).toMatchObject({ completed: 3, current: undefined, next: undefined });
  expect(f.data.conversationBindings.a.currentStepId).toBeUndefined();
});
it('does not promote or skip blocked next steps', () => {
  const f = fixture(); f.run({ type: 'setStatus', id: f.a, status: 'current' }); f.run({ type: 'setStatus', id: f.b, status: 'blocked' });
  f.run({ type: 'completeAndAdvance', id: f.a, expectedNextStepId: f.b, acknowledgeIssues: false });
  expect(f.data.steps[f.a].status).toBe('done'); expect(f.data.steps[f.b].status).toBe('blocked'); expect(f.data.steps[f.c].status).toBe('todo');
  expect(f.guide()).toMatchObject({ current: undefined, next: { id: f.b } });
  expect(f.data.conversationBindings.a.currentStepId).toBeUndefined();
});
it('returns to earlier unfinished work instead of claiming the plan is finished', () => {
  const f = fixture(); f.run({ type: 'setStatus', id: f.c, status: 'current' });
  expect(f.guide()).toMatchObject({ returning: true, next: { id: f.a } });
  f.run({ type: 'completeAndAdvance', id: f.c, expectedNextStepId: f.a, acknowledgeIssues: false });
  expect(f.data.steps[f.a].status).toBe('current'); expect(f.guide().completed).toBe(1);
});
it('rejects double clicks, stale next-step previews and current changes atomically', () => {
  const f = fixture(); f.run({ type: 'setStatus', id: f.a, status: 'current' });
  const before = structuredClone(f.data);
  expect(() => f.run({ type: 'completeAndAdvance', id: f.a, expectedNextStepId: f.c, acknowledgeIssues: false })).toThrow(); expect(f.data).toEqual(before);
  const command: Command = { type: 'completeAndAdvance', id: f.a, expectedNextStepId: f.b, acknowledgeIssues: false };
  f.run(command); const advanced = structuredClone(f.data);
  expect(() => f.run(command)).toThrow(); expect(f.data).toEqual(advanced);
});
it('requires acknowledgment for unresolved issues without resolving them automatically', () => {
  const f = fixture(); f.run({ type: 'setStatus', id: f.a, status: 'current' });
  f.run({ type: 'createThread', stepId: f.a, title: 'Still investigating', description: '' });
  expect(f.guide().unresolved).toBe(1);
  expect(() => f.run({ type: 'completeAndAdvance', id: f.a, expectedNextStepId: f.b, acknowledgeIssues: false })).toThrow();
  f.run({ type: 'completeAndAdvance', id: f.a, expectedNextStepId: f.b, acknowledgeIssues: true });
  expect(Object.values(f.data.threads)[0].resolved).toBe(false);
});
it('saves, edits and backs up instructions, commands and completion criteria', () => {
  const f = fixture();
  f.run({ type: 'editStep', id: f.a, key: '01', title: 'Environment', notes: 'Keep note', instructions: 'Open terminal', commands: 'python3 --version', completionCriteria: 'Version is shown' });
  const restored = parseBackup(serializeBackup(f.data));
  expect(restored.steps[f.a]).toMatchObject({ instructions: 'Open terminal', commands: 'python3 --version', completionCriteria: 'Version is shown', notes: 'Keep note' });
  // A pre-stage-6 editor that omits detail fields must not erase them.
  f.run({ type: 'editStep', id: f.a, key: '01', title: 'Changed', notes: '' });
  expect(f.data.steps[f.a].commands).toBe('python3 --version');
  f.run({ type: 'editStep', id: f.a, key: '01', title: 'Changed', notes: '', commands: '' });
  expect(f.data.steps[f.a].commands).toBe('');
});
it('validates detailed fields and accepts old backups without them', () => {
  const f = fixture(); expect(parseBackup(serializeBackup(f.data))).toEqual(f.data);
  expect(() => f.run({ type: 'editStep', id: f.a, key: '01', title: 'A', notes: '', instructions: 'x'.repeat(10001) })).toThrow();
  const invalid = structuredClone(f.data); invalid.steps[f.a].commands = 42 as unknown as string;
  expect(() => serializeBackup(invalid)).toThrow();
});
