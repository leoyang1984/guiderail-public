import { afterEach, expect, it, vi } from 'vitest';
import { ChromeStorageRepository, createDispatcher, STORAGE_KEY } from '../src/storage/storage';
import { emptyStorage } from '../src/storage/schema';

afterEach(() => vi.unstubAllGlobals());
function chromeStorage() {
  const disk: Record<string, unknown> = {};
  const set = vi.fn(async (data: Record<string, unknown>) => { Object.assign(disk, structuredClone(data)); });
  vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(async () => structuredClone(disk)), set } } });
  return { disk, set };
}

it('restores projects, order, notes and current step using a fresh repository', async () => {
  chromeStorage();
  const repository = new ChromeStorageRepository(); const dispatch = createDispatcher(repository);
  await dispatch({ type: 'createProject', name: 'TTS' });
  let data = await repository.read(); const project = data.projects[data.selectedProjectId!]; const planId = project.activePlanId!;
  await dispatch({ type: 'createStep', planId, key: 'STEP-01', title: 'Environment' });
  data = await repository.read(); const id = data.plans[planId].stepIds[0];
  await dispatch({ type: 'editStep', id, key: 'STEP-01', title: 'Environment', notes: 'Retain me' });
  await dispatch({ type: 'setStatus', id, status: 'current' });
  const restored = await new ChromeStorageRepository().read();
  expect(restored.selectedProjectId).toBe(project.id);
  expect(restored.steps[id]).toMatchObject({ status: 'current', notes: 'Retain me', order: 0 });
});
it('serializes concurrent writes without losing either project', async () => {
  chromeStorage(); const repository = new ChromeStorageRepository(); const dispatch = createDispatcher(repository);
  await Promise.all([dispatch({ type: 'createProject', name: 'A' }), dispatch({ type: 'createProject', name: 'B' })]);
  expect(Object.values((await repository.read()).projects).map(project => project.name)).toEqual(['A', 'B']);
});
it('keeps stored data after a failed write and allows the next operation', async () => {
  const { set } = chromeStorage(); const repository = new ChromeStorageRepository(); const dispatch = createDispatcher(repository);
  set.mockRejectedValueOnce(new Error('Quota exceeded'));
  await expect(dispatch({ type: 'createProject', name: 'Lost' })).rejects.toThrow('Quota');
  expect(await repository.read()).toEqual(emptyStorage());
  await dispatch({ type: 'createProject', name: 'Saved' });
  expect(Object.values((await repository.read()).projects).map(project => project.name)).toEqual(['Saved']);
});
it('does not overwrite unsupported storage', async () => {
  const { disk, set } = chromeStorage(); disk[STORAGE_KEY] = { version: 99 };
  const dispatch = createDispatcher(new ChromeStorageRepository());
  await expect(dispatch({ type: 'createProject', name: 'Oops' })).rejects.toThrow('Unsupported');
  expect(set).not.toHaveBeenCalled();
});
