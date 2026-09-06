import { expect, it, vi } from 'vitest';
import { locateMessage, type LocatePort } from '../src/content/locate';
function fixture(target: number, initial = 8000) {
  let top = initial, extent = 10000, time = 0, cancelled = false;
  const scroll = vi.fn((value: number) => { top = value; });
  const reveal = vi.fn(async () => top <= target && target < top + 600);
  const port: LocatePort = {
    cancelled: () => cancelled, find: () => top <= target && target < top + 600,
    reveal, viewport: () => ({ top, height: 600, extent, signature: `${Math.floor(top / 400)}` }),
    scroll, wait: async () => { time += 200; }, now: () => time,
  };
  return { port, scroll, reveal, cancel: () => { cancelled = true; }, setExtent: (value: number) => { extent = value; }, top: () => top };
}
it('reveals an already mounted target without searching', async () => {
  const f = fixture(8200); expect(await locateMessage(f.port)).toEqual({ found: true }); expect(f.scroll).not.toHaveBeenCalled();
});
it('loads older virtualized messages by scanning overlapping viewports', async () => {
  const f = fixture(1000); expect(await locateMessage(f.port)).toEqual({ found: true });
  expect(f.scroll.mock.calls.length).toBeGreaterThan(5); expect(f.top()).toBeLessThanOrEqual(1000);
});
it('searches downward as well when starting above the target', async () => {
  const f = fixture(8000, 3000); expect(await locateMessage(f.port)).toEqual({ found: true }); expect(f.top()).toBeGreaterThan(7000);
});
it('waits for asynchronously loaded history at the top', async () => {
  const f = fixture(-1, 0); let waits = 0, loaded = false;
  const originalWait = f.port.wait;
  f.port.wait = async () => { await originalWait(); if (++waits === 5) { loaded = true; f.setExtent(13000); } };
  f.port.find = () => loaded; f.port.reveal = async () => loaded;
  expect(await locateMessage(f.port)).toEqual({ found: true }); expect(waits).toBe(5);
});
it('stops after user interruption without restoring over the user scroll', async () => {
  const f = fixture(1000); f.port.wait = async () => { f.cancel(); };
  expect(await locateMessage(f.port)).toMatchObject({ found: false, reason: 'cancelled' }); expect(f.scroll).toHaveBeenCalledTimes(1);
});
it('requires successful reveal rather than treating an ID lookup alone as success', async () => {
  const f = fixture(8200); f.port.reveal = async () => false;
  expect(await locateMessage(f.port, 1000)).toMatchObject({ found: false }); expect(f.top()).toBe(8000);
});
it('bounds failed searches and restores the initial position', async () => {
  const f = fixture(-1); expect(await locateMessage(f.port, 1000)).toMatchObject({ found: false, reason: 'not-found' });
  expect(f.scroll.mock.calls.length).toBeLessThanOrEqual(6); expect(f.top()).toBe(8000);
});
it('waits for the first render if no scroll container exists yet', async () => {
  const f = fixture(8200); let checks = 0; const original = f.port.viewport;
  f.port.viewport = () => ++checks < 3 ? null : original(); f.port.find = () => checks >= 3;
  expect(await locateMessage(f.port)).toEqual({ found: true });
});
