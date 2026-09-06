import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage, type Command, type GuideRailStorage } from '../src/storage/schema';

function fixture() {
  let data = emptyStorage(); let sequence = 0;
  const run = (command: Command) => { data = applyCommand(data, command, `time-${sequence}`, () => `id-${++sequence}`); return data; };
  run({ type: 'createProject', name: 'Local TTS Server' });
  const projectId = data.selectedProjectId!; const planId = data.projects[projectId].activePlanId!;
  const add = (key: string) => { run({ type: 'createStep', planId, key, title: `Task ${key}` }); return data.plans[planId].stepIds.at(-1)!; };
  return { run, add, projectId, planId, get data() { return data; } };
}

describe('plan domain', () => {
  it('creates a project with an empty active plan, renames and selects projects', () => {
    const f = fixture();
    expect(f.data.plans[f.planId].stepIds).toEqual([]);
    f.run({ type: 'renameProject', id: f.projectId, name: '  TTS  ' });
    f.run({ type: 'renamePlan', id: f.planId, title: 'Deployment' });
    f.run({ type: 'createProject', name: 'Other project' });
    f.run({ type: 'selectProject', id: f.projectId });
    expect(f.data.selectedProjectId).toBe(f.projectId);
    expect(f.data.projects[f.projectId].name).toBe('TTS');
    expect(f.data.plans[f.planId].title).toBe('Deployment');
  });
  it('keeps only one current step and does not change done steps', () => {
    const f = fixture(); const a = f.add('A'); const b = f.add('B'); const c = f.add('C');
    f.run({ type: 'setStatus', id: c, status: 'done' });
    f.run({ type: 'setStatus', id: a, status: 'current' });
    f.run({ type: 'setStatus', id: b, status: 'current' });
    expect([a, b, c].map(id => f.data.steps[id].status)).toEqual(['todo', 'current', 'done']);
    f.run({ type: 'setStatus', id: b, status: 'blocked' });
    expect(f.data.steps[b].status).toBe('blocked');
  });
  it('selection is separate from current step and plans keep independent current steps', () => {
    const f = fixture(); const a = f.add('A'); f.run({ type: 'setStatus', id: a, status: 'current' });
    f.run({ type: 'createProject', name: 'Other' });
    expect(f.data.steps[a].status).toBe('current');
    expect(f.data.selectedProjectId).not.toBe(f.projectId);
  });
  it('edits notes, reorders and renumbers after deletion', () => {
    const f = fixture(); const a = f.add('A'); const b = f.add('B'); const c = f.add('C');
    f.run({ type: 'editStep', id: b, key: 'B2', title: 'New title', notes: 'A note' });
    f.run({ type: 'moveStep', id: b, direction: -1 });
    expect(f.data.plans[f.planId].stepIds).toEqual([b, a, c]);
    expect(f.data.steps[b].notes).toBe('A note');
    f.run({ type: 'deleteStep', id: a });
    expect(f.data.plans[f.planId].stepIds).toEqual([b, c]);
    expect([b, c].map(id => f.data.steps[id].order)).toEqual([0, 1]);
    expect(f.data.steps[a]).toBeUndefined();
    f.run({ type: 'moveStep', id: b, direction: -1 });
    expect(f.data.plans[f.planId].stepIds).toEqual([b, c]);
  });
  it('rejects blank titles, duplicate keys, unknown IDs and invalid statuses without mutating input', () => {
    const f = fixture(); const a = f.add('A'); const before = structuredClone(f.data);
    const bad: Command[] = [
      { type: 'createProject', name: ' ' }, { type: 'createStep', planId: f.planId, key: 'a', title: 'Duplicate' },
      { type: 'editStep', id: a, key: 'A', title: ' ', notes: '' },
      { type: 'setStatus', id: 'missing', status: 'done' },
      { type: 'setStatus', id: a, status: 'unexpected' } as unknown as Command,
    ];
    for (const command of bad) expect(() => f.run(command)).toThrow();
    expect(f.data).toEqual(before);
  });
  it('updates parent timestamps and removes dependent references on delete', () => {
    const f = fixture(); const a = f.add('A');
    const source: GuideRailStorage = structuredClone(f.data);
    source.threads.t = { id: 't', stepId: a, title: 'Issue', resolved: false, createdAt: 'old', updatedAt: 'old' };
    source.conversationBindings.c = { conversationId: 'c', projectId: f.projectId, planId: f.planId, currentStepId: a, pageUrl: '', createdAt: 'old', updatedAt: 'old' };
    const next = applyCommand(source, { type: 'deleteStep', id: a }, 'new');
    expect(next.threads.t).toBeUndefined();
    expect(next.conversationBindings.c.currentStepId).toBeUndefined();
    expect(next.projects[f.projectId].updatedAt).toBe('new');
    expect(next.plans[f.planId].updatedAt).toBe('new');
    expect(source.steps[a]).toBeDefined();
  });
});
