export interface LocateViewport { top: number; height: number; extent: number; signature: string }
export interface LocatePort {
  cancelled(): boolean;
  find(): boolean;
  reveal(): Promise<boolean>;
  viewport(): LocateViewport | null;
  scroll(top: number): void;
  wait(): Promise<void>;
  now(): number;
}
export type LocateResult = { found: boolean; reason?: 'cancelled' | 'unavailable' | 'not-found' };
/** Walk overlapping viewports so virtualized messages can mount before inspecting their IDs. */
export async function locateMessage(port: LocatePort, budgetMs = 40000): Promise<LocateResult> {
  const deadline = port.now() + budgetMs;
  const initial = port.viewport();
  let direction = -1; let stalled = 0;
  for (let iteration = 0; iteration < 220 && port.now() < deadline; iteration++) {
    if (port.cancelled()) return { found: false, reason: 'cancelled' };
    if (port.find() && await port.reveal()) {
      if (port.cancelled()) return { found: false, reason: 'cancelled' };
      return { found: true };
    }
    const before = port.viewport();
    if (!before) { await port.wait(); continue; }
    const amount = Math.max(80, before.height * .75);
    port.scroll(Math.max(0, Math.min(Math.max(0, before.extent - before.height), before.top + direction * amount)));
    await port.wait();
    if (port.cancelled()) return { found: false, reason: 'cancelled' };
    const after = port.viewport();
    if (!after) continue;
    // At an edge, give asynchronous history loading time to change the viewport or mounted IDs.
    const unchanged = Math.abs(after.top - before.top) < 2 && Math.abs(after.extent - before.extent) < 2 && after.signature === before.signature;
    stalled = unchanged ? stalled + 1 : 0;
    if (stalled >= 8) {
      if (direction === -1) { direction = 1; stalled = 0; }
      else break;
    }
  }
  if (port.cancelled()) return { found: false, reason: 'cancelled' };
  if (port.find() && await port.reveal() && !port.cancelled()) return { found: true };
  if (initial && !port.cancelled()) port.scroll(initial.top);
  return { found: false, reason: initial ? 'not-found' : 'unavailable' };
}
