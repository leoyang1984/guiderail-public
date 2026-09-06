import { validateBackup } from './backup';
import { emptyStorage, type Command, type GuideRailStorage } from './schema';
import { applyCommand } from '../domain/plan';
export const STORAGE_KEY = 'guiderail';
export interface StorageRepository { read(): Promise<GuideRailStorage>; write(data: GuideRailStorage): Promise<void> }
export class ChromeStorageRepository implements StorageRepository {
  async read(): Promise<GuideRailStorage> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result[STORAGE_KEY] === undefined) return emptyStorage();
    if (![1, 2, 3].includes(result[STORAGE_KEY]?.version)) throw new Error('Unsupported storage format');
    return validateBackup(result[STORAGE_KEY]);
  }
  async write(data: GuideRailStorage): Promise<void> { await chrome.storage.local.set({ [STORAGE_KEY]: data }); }
}
/** All panels send writes to one service worker to avoid read/modify/write races. */
export function createDispatcher(repository: StorageRepository) {
  let tail: Promise<unknown> = Promise.resolve();
  return (command: Command): Promise<void> => {
    const operation = tail.then(async () => { const next = applyCommand(await repository.read(), command); await repository.write(validateBackup(next)); });
    tail = operation.catch(() => {});
    return operation;
  };
}
export async function sendCommand(command: Command): Promise<void> {
  const result = await chrome.runtime.sendMessage({ kind: 'guiderail:command', command }) as { ok?: boolean } | undefined;
  if (!result?.ok) throw new Error('Could not save changes');
}
