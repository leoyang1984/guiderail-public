import { expect, it, vi } from 'vitest';
import { writeNewFile } from '../src/export/directory';
function fixture(exists = false) {
  const stream = { write: vi.fn(async () => {}), close: vi.fn(async () => {}), abort: vi.fn(async () => {}) };
  const createWritable = vi.fn(async () => stream);
  const getFileHandle = vi.fn(async (_name: string, options?: { create?: boolean }) => {
    if (!exists && !options?.create) throw new DOMException('Missing', 'NotFoundError');
    return { createWritable };
  });
  const removeEntry = vi.fn(async () => {});
  return { directory: { getFileHandle, removeEntry } as unknown as FileSystemDirectoryHandle, stream, createWritable, getFileHandle, removeEntry };
}
it('never opens an existing note for writing', async () => {
  const { directory, createWritable } = fixture(true);
  expect(await writeNewFile(directory, 'note.md', 'replacement')).toBe('skipped');
  expect(createWritable).not.toHaveBeenCalled();
});
it('writes and closes a new Markdown file before reporting success', async () => {
  const { directory, stream, removeEntry } = fixture();
  expect(await writeNewFile(directory, 'note.md', '---\ntitle: "Hello"\n---')).toBe('written');
  expect(stream.write).toHaveBeenCalledWith('---\ntitle: "Hello"\n---');
  expect(stream.close).toHaveBeenCalledOnce();
  expect(removeEntry).not.toHaveBeenCalled();
});
it('does not interpret permission failure as a missing file', async () => {
  const { directory, getFileHandle, createWritable } = fixture();
  getFileHandle.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  await expect(writeNewFile(directory, 'note.md', 'body')).rejects.toThrow('Denied');
  expect(createWritable).not.toHaveBeenCalled();
});
it('aborts on write failure and propagates failure', async () => {
  const { directory, stream, removeEntry } = fixture();
  stream.write.mockRejectedValueOnce(new Error('Disk full'));
  await expect(writeNewFile(directory, 'note.md', 'body')).rejects.toThrow('Disk full');
  expect(stream.abort).toHaveBeenCalledOnce();
  expect(stream.close).not.toHaveBeenCalled();
  expect(removeEntry).toHaveBeenCalledWith('note.md');
});
