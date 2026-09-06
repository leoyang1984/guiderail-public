export interface ExportDirectory extends FileSystemDirectoryHandle {
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}
export type DirectoryPicker = (options: { mode: 'readwrite'; id: string }) => Promise<ExportDirectory>;

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('guiderail-export', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('settings'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadDirectory(): Promise<ExportDirectory | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('settings').objectStore('settings').get('directory');
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function storeDirectory(directory: ExportDirectory): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(directory, 'directory');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function writeNewFile(directory: FileSystemDirectoryHandle, name: string, text: string): Promise<'written' | 'skipped'> {
  // Serialize this extension's exports across panels/windows before checking existence.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('guiderail-export-files', () => writeFile(directory, name, text));
  }
  return writeFile(directory, name, text);
}
async function writeFile(directory: FileSystemDirectoryHandle, name: string, text: string): Promise<'written' | 'skipped'> {
  try {
    await directory.getFileHandle(name);
    return 'skipped';
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
  }
  const file = await directory.getFileHandle(name, { create: true });
  let stream: FileSystemWritableFileStream | undefined;
  try { stream = await file.createWritable(); await stream.write(text); await stream.close(); }
  catch (error) {
    await stream?.abort().catch(() => {});
    // Remove only the placeholder created by this failed export, so a retry can succeed.
    await directory.removeEntry(name).catch(() => {});
    throw error;
  }
  return 'written';
}
