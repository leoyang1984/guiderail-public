import type { GuideRailStorage } from './schema';
import { getChatGPTConversationId } from '../domain/conversation';
import { getThreadUrl } from '../domain/thread';
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const fail = (): never => { throw new Error('Invalid GuideRail backup file'); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 10000, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) return fail();
  return value;
}
function safeId(value: unknown): string {
  const id = string(value, 200);
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) return fail();
  return id;
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return fail();
  const result = value.map(safeId); if (new Set(result).size !== result.length) return fail(); return result;
}
function optional(value: unknown, max = 10000) { if (value !== undefined) string(value, max, true); }
function dates(record: Record<string, unknown>) {
  for (const key of ['createdAt', 'updatedAt']) {
    const date = string(record[key], 40); if (!/^\d{4}-\d\d-\d\dT/.test(date) || !Number.isFinite(Date.parse(date))) fail();
  }
}
function table(value: unknown): Record<string, Record<string, unknown>> {
  const records = object(value);
  for (const [id, item] of Object.entries(records)) { safeId(id); object(item); }
  return records as Record<string, Record<string, unknown>>;
}
/** Validate both field types and all graph references before any storage write. */
export function validateBackup(value: unknown): GuideRailStorage {
  let data = object(value);
  if (![1, 2, 3].includes(data.version as number)) fail();
  if (data.version === 1) data = { ...data, version: 2, sources: {}, sourceLinks: {} };
  if (data.version === 2) {
    data = structuredClone(data);
    const oldPlans = table(data.plans), oldSteps = table(data.steps);
    const phases: Record<string, unknown> = {};
    Object.entries(oldPlans).forEach(([key, plan], index) => {
      const id = `legacy-phase-${index}`;
      phases[id] = { id, planId: key, title: '默认阶段', createdAt: plan.createdAt, updatedAt: plan.updatedAt };
      plan.phaseIds = [id];
      for (const step of Object.values(oldSteps)) if (step.planId === key) step.phaseId = id;
    });
    data.phases = phases; data.version = 3;
  }
  const migrated = data;
  const projects = table(data.projects), plans = table(data.plans), steps = table(data.steps), threads = table(data.threads), bindings = table(data.conversationBindings);
  for (const [key, item] of Object.entries(projects)) {
    if (safeId(item.id) !== key) fail(); dates(item); string(item.name, 120); optional(item.description);
    if (item.activePlanId !== null && (!plans[safeId(item.activePlanId)] || plans[item.activePlanId as string].projectId !== key)) fail();
  }
  const phases = table(data.phases); const listedPhases = new Set<string>();
  const listedSteps = new Set<string>(), listedThreads = new Set<string>();
  for (const [key, item] of Object.entries(plans)) {
    if (safeId(item.id) !== key || !projects[safeId(item.projectId)]) fail();
    dates(item); string(item.title, 180); string(item.markdownSource, MAX_BACKUP_BYTES, true); optional(item.description);
    optional(item.goal); optional(item.completionCriteria);
    const phaseIds = ids(item.phaseIds); if (!phaseIds.length) fail();
    for (const id of phaseIds) {
      if (!phases[id] || phases[id].planId !== key || listedPhases.has(id)) fail(); listedPhases.add(id);
    }
    let lastPhaseIndex = -1;
    let currents = 0; const keys = new Set<string>();
    ids(item.stepIds).forEach((id, index) => {
      const step = steps[id]; if (!step || step.planId !== key || step.order !== index || listedSteps.has(id)) fail();
      const phaseIndex = phaseIds.indexOf(safeId(step.phaseId));
      if (phaseIndex < 0 || phaseIndex < lastPhaseIndex) fail(); lastPhaseIndex = phaseIndex;
      listedSteps.add(id); if (step.status === 'current') currents++;
      const stepKey = string(step.key, 40).toLowerCase(); if (keys.has(stepKey)) fail(); keys.add(stepKey);
    });
    if (currents > 1) fail();
  }
  for (const [key, item] of Object.entries(phases)) {
    if (safeId(item.id) !== key || !listedPhases.has(key)) fail(); dates(item); string(item.title, 180);
  }
  for (const [key, item] of Object.entries(steps)) {
    if (safeId(item.id) !== key || !listedSteps.has(key) || !plans[safeId(item.planId)]) fail();
    dates(item); string(item.key, 40); string(item.title, 240); optional(item.notes); optional(item.instructions); optional(item.commands); optional(item.completionCriteria);
    if (!['todo', 'current', 'done', 'blocked'].includes(item.status as string) || !Number.isInteger(item.order) || (item.order as number) < 0) fail();
    for (const id of ids(item.threadIds)) {
      if (!threads[id] || threads[id].stepId !== key || listedThreads.has(id)) fail(); listedThreads.add(id);
    }
  }
  for (const [key, item] of Object.entries(threads)) {
    if (safeId(item.id) !== key || !listedThreads.has(key) || !steps[safeId(item.stepId)]) fail();
    dates(item); string(item.title, 240); optional(item.description);
    if (typeof item.resolved !== 'boolean') fail();
    if (item.pageUrl !== undefined) string(item.pageUrl, 4096);
    if (item.conversationId !== undefined) safeId(item.conversationId);
    if ((item.pageUrl !== undefined || item.conversationId !== undefined) && !getThreadUrl(item as { pageUrl?: string; conversationId?: string })) fail();
  }
  for (const [key, item] of Object.entries(bindings)) {
    if (safeId(item.conversationId) !== key || !projects[safeId(item.projectId)] || !plans[safeId(item.planId)] || plans[item.planId as string].projectId !== item.projectId) fail();
    dates(item); if (getChatGPTConversationId(string(item.pageUrl, 4096)) !== key) fail();
    const current = (plans[item.planId as string].stepIds as string[]).find(id => steps[id].status === 'current');
    if (item.currentStepId !== undefined && safeId(item.currentStepId) !== current) fail();
  }
  if (data.selectedProjectId !== null && !projects[safeId(data.selectedProjectId)]) fail();
  // Return a JSON-only deep copy, eliminating prototypes and undefined properties.
  const sources = table(migrated.sources), links = table(migrated.sourceLinks);
  const pairs = new Set<string>();
  for (const [key, item] of Object.entries(sources)) {
    if (safeId(item.id) !== key) fail(); dates(item);
    safeId(item.messageId); safeId(item.conversationId); optional(item.html, 400000); optional(item.title, 240);
    if (getChatGPTConversationId(string(item.pageUrl, 4096)) !== item.conversationId) fail();
    if (!['assistant', 'user'].includes(item.role as string)) fail(); string(item.text, 200000);
    const pair = `${item.conversationId}:${item.messageId}`; if (pairs.has(pair)) fail(); pairs.add(pair);
  }
  const associations = new Set<string>();
  for (const [key, item] of Object.entries(links)) {
    if (safeId(item.id) !== key || !sources[safeId(item.sourceId)] || !steps[safeId(item.stepId)]) fail(); dates(item);
    if (!['operation', 'troubleshooting', 'conclusion'].includes(item.category as string)) fail();
    const pair = `${item.sourceId}:${item.stepId}`; if (associations.has(pair)) fail(); associations.add(pair);
  }
  const json = JSON.stringify(migrated);
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) fail();
  return JSON.parse(json) as GuideRailStorage;
}
export function parseBackup(text: string): GuideRailStorage {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) return fail();
  return validateBackup(JSON.parse(text));
}
export function serializeBackup(data: GuideRailStorage): string {
  return JSON.stringify(validateBackup(data));
}
