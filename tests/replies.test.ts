import { expect, it } from 'vitest';
import { applyCommand } from '../src/domain/plan';
import { emptyStorage, type Capture } from '../src/storage/schema';
import { parseBackup, serializeBackup } from '../src/storage/backup';
const capture: Capture = { conversationId: 'chat', messageId: 'reply', role: 'assistant', pageUrl: 'https://chatgpt.com/c/chat', text: '长计划', html: '<h2>长计划</h2><ol><li>准备</li></ol>' };
it('saves a formatted reply without creating projects or tasks and deduplicates', () => {
  const next = applyCommand(emptyStorage(), { type: 'saveReply', capture });
  expect(Object.keys(next.projects)).toHaveLength(0); expect(Object.keys(next.steps)).toHaveLength(0); expect(Object.keys(next.sources)).toHaveLength(1);
  expect(applyCommand(next, { type: 'saveReply', capture })).toEqual(next);
  expect(parseBackup(serializeBackup(next))).toEqual(next);
});
it('does not overwrite a saved snapshot when the same message changes', () => {
  const next = applyCommand(emptyStorage(), { type: 'saveReply', capture });
  expect(applyCommand(next, { type: 'saveReply', capture: { ...capture, text: 'Changed' } })).toEqual(next);
});
it('batch deletes replies and legacy links but preserves unrelated task data', () => {
  let data = applyCommand(emptyStorage(), { type: 'createProject', name: 'Legacy' }); const planId = Object.keys(data.plans)[0];
  data = applyCommand(data, { type: 'captureMessage', planId, title: 'Legacy step', capture });
  data = applyCommand(data, { type: 'saveReply', capture: { ...capture, messageId: 'second' } });
  const next = applyCommand(data, { type: 'deleteReplies', ids: Object.keys(data.sources) });
  expect(next.sources).toEqual({}); expect(next.sourceLinks).toEqual({}); expect(next.steps).toEqual(data.steps);
  expect(() => applyCommand(data, { type: 'deleteReplies', ids: ['missing'] })).toThrow(); expect(Object.keys(data.sources)).toHaveLength(2);
});
it('clears all old tasks and replies with a fresh snapshot, refusing stale confirmation', () => {
  const data = applyCommand(emptyStorage(), { type: 'createProject', name: 'Old' });
  expect(applyCommand(data, { type: 'clearAll', expectedSource: JSON.stringify(data) })).toEqual(emptyStorage());
  expect(() => applyCommand(data, { type: 'clearAll', expectedSource: JSON.stringify(emptyStorage()) })).toThrow('changed');
});
