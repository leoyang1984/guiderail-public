import { parseOutline } from './outline';
import { getGuidance } from './guidance';
import { parseChecklist } from './markdown';
import { validateBackup } from '../storage/backup';
import { threadLink } from './thread';
import { getChatGPTConversationId } from './conversation';
import { emptyStorage } from '../storage/schema';
import type { Command, GuideRailStorage, StepStatus } from '../storage/schema';

const statuses: StepStatus[] = ['todo', 'current', 'done', 'blocked'];
function required(value: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('Invalid text');
  return value.trim();
}

function detailFields(command: { instructions?: string; commands?: string; completionCriteria?: string }) {
  const result: { instructions?: string; commands?: string; completionCriteria?: string } = {};
  for (const key of ['instructions', 'commands', 'completionCriteria'] as const) {
    if (command[key] !== undefined) {
      if (typeof command[key] !== 'string' || command[key].length > 10000) throw new Error('Invalid step details');
      result[key] = command[key];
    }
  }
  return result;
}

/** Pure copy-on-write mutation. A failed operation never changes the saved state. */
export function applyCommand(source: GuideRailStorage, command: Command, now = new Date().toISOString(), id: () => string = () => crypto.randomUUID()): GuideRailStorage {
  if (command.type === 'restoreBackup') {
    if (command.expectedSource !== JSON.stringify(source)) throw new Error('Data changed since confirmation');
    return validateBackup(command.data);
  }
  const data = structuredClone(source);
  const project = (key: string) => { const value = data.projects[key]; if (!value) throw new Error('Project missing'); return value; };
  const plan = (key: string) => { const value = data.plans[key]; if (!value) throw new Error('Plan missing'); return value; };
  const step = (key: string) => { const value = data.steps[key]; if (!value) throw new Error('Step missing'); return value; };
  const touchPlan = (key: string) => { const value = plan(key); value.updatedAt = now; project(value.projectId).updatedAt = now; return value; };
  const uniqueKey = (planId: string, key: string, except?: string) => {
    if (plan(planId).stepIds.some(existing => existing !== except && step(existing).key.toLowerCase() === key.toLowerCase())) throw new Error('Duplicate step key');
  };
  const bind = (conversationId: string, pageUrl: string, projectId: string, planId: string) => {
    if (!conversationId || getChatGPTConversationId(pageUrl) !== conversationId) throw new Error('Invalid conversation URL');
    const owner = plan(planId);
    if (owner.projectId !== projectId) throw new Error('Plan does not belong to project');
    project(projectId);
    const previous = data.conversationBindings[conversationId];
    const currentStepId = owner.stepIds.find(key => step(key).status === 'current');
    data.conversationBindings[conversationId] = {
      conversationId, projectId, planId, currentStepId, pageUrl,
      createdAt: previous?.createdAt ?? now, updatedAt: now,
    };
  };
  const phase = (key: string) => { const value = data.phases[key]; if (!value) throw new Error('Phase missing'); return value; };
  const regroup = (planId: string) => {
    const owner = plan(planId);
    owner.stepIds = owner.phaseIds.flatMap(phaseId => owner.stepIds.filter(key => step(key).phaseId === phaseId));
    owner.stepIds.forEach((key, order) => { if (step(key).order !== order) { step(key).order = order; step(key).updatedAt = now; } });
  };
  switch (command.type) {
    case 'clearAll': {
      if (command.expectedSource !== JSON.stringify(source)) throw new Error('Data changed since confirmation');
      return emptyStorage();
    }
    case 'deleteReplies': {
      if (!Array.isArray(command.ids) || command.ids.some(key => !Object.hasOwn(data.sources, key))) throw new Error('Source missing');
      const removing = new Set(command.ids);
      for (const key of removing) delete data.sources[key];
      for (const link of Object.values(data.sourceLinks)) if (removing.has(link.sourceId)) delete data.sourceLinks[link.id];
      break;
    }
    case 'renameReply': {
      const saved = data.sources[command.id]; if (!saved) throw new Error('Source missing');
      saved.title = required(command.title, 240); break;
    }
    case 'saveReply': {
      const capture = command.capture;
      let saved = Object.values(data.sources).find(item => item.conversationId === capture.conversationId && item.messageId === capture.messageId);
      // An existing bookmark is never silently overwritten by a changed page.
      if (saved) break;
      const sourceId = id(); saved = { ...capture, id: sourceId, createdAt: now, updatedAt: now }; data.sources[sourceId] = saved;
      return validateBackup(data);
    }
    case 'editGoal': {
      const owner = touchPlan(command.planId);
      if (typeof command.goal !== 'string' || command.goal.length > 10000 || typeof command.completionCriteria !== 'string' || command.completionCriteria.length > 10000) throw new Error('Invalid goal');
      owner.goal = command.goal.trim(); owner.completionCriteria = command.completionCriteria.trim(); break;
    }
    case 'createPhase': {
      const owner = touchPlan(command.planId); const phaseId = id();
      data.phases[phaseId] = { id: phaseId, planId: owner.id, title: required(command.title, 180), createdAt: now, updatedAt: now }; owner.phaseIds.push(phaseId); break;
    }
    case 'renamePhase': { const value = phase(command.id); value.title = required(command.title, 180); value.updatedAt = now; touchPlan(value.planId); break; }
    case 'movePhase': {
      if (command.direction !== -1 && command.direction !== 1) throw new Error('Invalid direction');
      const value = phase(command.id); const owner = touchPlan(value.planId); const index = owner.phaseIds.indexOf(value.id); const next = index + command.direction;
      if (next >= 0 && next < owner.phaseIds.length) { [owner.phaseIds[index], owner.phaseIds[next]] = [owner.phaseIds[next], owner.phaseIds[index]]; regroup(owner.id); } break;
    }
    case 'deletePhase': {
      const value = phase(command.id); const owner = plan(value.planId);
      if (owner.phaseIds.length === 1 || owner.stepIds.some(key => step(key).phaseId === value.id)) throw new Error('Only empty non-final phases can be removed');
      owner.phaseIds = owner.phaseIds.filter(key => key !== value.id); delete data.phases[value.id]; touchPlan(owner.id); break;
    }
    case 'assignPhase': {
      const value = step(command.stepId); const target = phase(command.phaseId);
      if (target.planId !== value.planId) throw new Error('Wrong plan');
      if (value.phaseId === target.id) break;
      const owner = plan(value.planId); owner.stepIds = [...owner.stepIds.filter(key => key !== value.id), value.id];
      value.phaseId = target.id; value.updatedAt = now; touchPlan(value.planId); regroup(value.planId); break;
    }
    case 'importOutline': {
      const owner = plan(command.planId); const outline = parseOutline(command.source, owner.stepIds.map(key => step(key).key));
      if (owner.markdownSource.length + command.source.length > 1000000) throw new Error('Plan source too large');
      for (const group of outline.phases) {
        const phaseId = id(); data.phases[phaseId] = { id: phaseId, planId: owner.id, title: group.title, createdAt: now, updatedAt: now }; owner.phaseIds.push(phaseId);
        for (const entry of group.steps) { const stepId = id(); data.steps[stepId] = { ...entry, id: stepId, phaseId, planId: owner.id, order: owner.stepIds.length, threadIds: [], createdAt: now, updatedAt: now }; owner.stepIds.push(stepId); }
      }
      if (command.applyGoal) { if (outline.goal) owner.goal = outline.goal; if (outline.completionCriteria) owner.completionCriteria = outline.completionCriteria; }
      regroup(owner.id);
      owner.markdownSource += `${owner.markdownSource ? '\n\n' : ''}${command.source}`; touchPlan(owner.id); break;
    }
    case 'captureMessage': {
      const owner = plan(command.planId);
      const capture = command.capture;
      if (getChatGPTConversationId(capture.pageUrl) !== capture.conversationId) throw new Error('Invalid source');
      let target = command.stepId ? step(command.stepId) : undefined;
      if (target && target.planId !== owner.id) throw new Error('Wrong plan');
      if (!target) {
        const title = required(command.title ?? '', 240); let number = 1;
        while (owner.stepIds.some(key => step(key).key.toLowerCase() === `step-${String(number).padStart(2, '0')}`)) number++;
        const stepId = id();
        target = { id: stepId, phaseId: owner.phaseIds.find(phaseId => owner.stepIds.some(key => step(key).phaseId === phaseId && step(key).status === 'current')) ?? owner.phaseIds[0], planId: owner.id, key: `STEP-${String(number).padStart(2, '0')}`, title, status: 'todo', order: owner.stepIds.length, threadIds: [], createdAt: now, updatedAt: now };
        data.steps[stepId] = target; owner.stepIds.push(stepId); regroup(owner.id);
      }
      let saved = Object.values(data.sources).find(item => item.conversationId === capture.conversationId && item.messageId === capture.messageId);
      if (saved && (saved.text !== capture.text || saved.role !== capture.role)) {
        if (!command.replaceSnapshot) throw new Error('Snapshot changed; explicit confirmation required');
        saved.text = capture.text; saved.role = capture.role; saved.updatedAt = now;
      }
      if (!saved) { const sourceId = id(); saved = { ...capture, id: sourceId, createdAt: now, updatedAt: now }; data.sources[sourceId] = saved; }
      if (!Object.values(data.sourceLinks).some(link => link.sourceId === saved.id && link.stepId === target.id)) {
        const linkId = id(); data.sourceLinks[linkId] = { id: linkId, sourceId: saved.id, stepId: target.id, category: 'operation', createdAt: now, updatedAt: now };
      }
      target.updatedAt = now; touchPlan(owner.id);
      return validateBackup(data);
    }
    case 'unlinkSource':
    case 'categorizeSource': {
      const link = data.sourceLinks[command.id]; if (!link) throw new Error('Source link missing');
      touchPlan(step(link.stepId).planId);
      if (command.type === 'unlinkSource') {
        delete data.sourceLinks[link.id];
        if (!Object.values(data.sourceLinks).some(other => other.sourceId === link.sourceId)) delete data.sources[link.sourceId];
      } else { link.category = command.category; link.updatedAt = now; }
      return validateBackup(data);
    }
    case 'importMarkdown': {
      const owner = plan(command.planId);
      const imported = parseChecklist(command.source, owner.stepIds.map(key => step(key).key));
      if (owner.markdownSource.length + command.source.length > 1000000) throw new Error('Plan source too large');
      for (const entry of imported) {
        const stepId = id();
        data.steps[stepId] = { id: stepId, phaseId: owner.phaseIds[0], planId: owner.id, ...entry, order: owner.stepIds.length, threadIds: [], createdAt: now, updatedAt: now };
        owner.stepIds.push(stepId);
      }
      regroup(owner.id);
      owner.markdownSource += `${owner.markdownSource ? '\n\n' : ''}${command.source}`;
      touchPlan(owner.id); break;
    }
    case 'createProject': {
      const name = required(command.name, 120); const projectId = id(); const planId = id(); const phaseId = id();
      data.projects[projectId] = { id: projectId, name, activePlanId: planId, createdAt: now, updatedAt: now };
      data.plans[planId] = { id: planId, projectId, title: `${name} · 执行计划`, phaseIds: [phaseId], markdownSource: '', stepIds: [], createdAt: now, updatedAt: now };
      data.phases[phaseId] = { id: phaseId, planId, title: '默认阶段', createdAt: now, updatedAt: now };
      data.selectedProjectId = projectId;
      if (command.conversation) bind(command.conversation.conversationId, command.conversation.pageUrl, projectId, planId);
      break;
    }
    case 'bindConversation': { bind(command.conversationId, command.pageUrl, command.projectId, command.planId); break; }
    case 'renameProject': { const value = project(command.id); value.name = required(command.name, 120); value.updatedAt = now; break; }
    case 'selectProject': { project(command.id); data.selectedProjectId = command.id; break; }
    case 'renamePlan': { touchPlan(command.id).title = required(command.title, 180); break; }
    case 'createStep': {
      const value = touchPlan(command.planId); const key = required(command.key, 40); const title = required(command.title, 240);
      const phaseId = command.phaseId ?? value.phaseIds[0]; if (phase(phaseId).planId !== value.id) throw new Error('Wrong plan');
      uniqueKey(value.id, key); const stepId = id();
      data.steps[stepId] = { id: stepId, phaseId, planId: value.id, key, title, status: 'todo', order: value.stepIds.length, ...detailFields(command), notes: '', threadIds: [], createdAt: now, updatedAt: now };
      value.stepIds.push(stepId); regroup(value.id); break;
    }
    case 'editStep': {
      const value = step(command.id); const key = required(command.key, 40); uniqueKey(value.planId, key, value.id);
      if (typeof command.notes !== 'string' || command.notes.length > 10000) throw new Error('Invalid notes');
      value.key = key; value.title = required(command.title, 240); value.notes = command.notes; Object.assign(value, detailFields(command)); value.updatedAt = now; touchPlan(value.planId); break;
    }
    case 'completeAndAdvance': {
      const value = step(command.id); const owner = plan(value.planId);
      const guide = getGuidance(data, owner);
      if (guide.current?.id !== value.id || (guide.next?.id ?? null) !== command.expectedNextStepId) throw new Error('Progress changed; refresh before advancing');
      if (guide.unresolved && command.acknowledgeIssues !== true) throw new Error('Unresolved issues need confirmation');
      value.status = 'done'; value.updatedAt = now;
      const next = guide.next;
      if (next && next.status !== 'blocked') { next.status = 'current'; next.updatedAt = now; }
      for (const binding of Object.values(data.conversationBindings)) if (binding.planId === owner.id) {
        if (next && next.status === 'current') binding.currentStepId = next.id;
        else delete binding.currentStepId;
        binding.updatedAt = now;
      }
      touchPlan(owner.id); break;
    }
    case 'setStatus': {
      if (!statuses.includes(command.status)) throw new Error('Invalid status');
      const value = step(command.id); const owner = touchPlan(value.planId);
      if (command.status === 'current') for (const key of owner.stepIds) {
        const other = step(key); if (other.status === 'current' && other.id !== value.id) { other.status = 'todo'; other.updatedAt = now; }
      }
      value.status = command.status; value.updatedAt = now;
      const currentStepId = owner.stepIds.find(key => step(key).status === 'current');
      for (const binding of Object.values(data.conversationBindings)) {
        if (binding.planId === owner.id && binding.currentStepId !== currentStepId) {
          if (currentStepId) binding.currentStepId = currentStepId;
          else delete binding.currentStepId;
          binding.updatedAt = now;
        }
      }
      break;
    }
    case 'createThread': {
      const owner = step(command.stepId); const title = required(command.title, 240);
      if (typeof command.description !== 'string' || command.description.length > 10000) throw new Error('Invalid description');
      const link = threadLink(command.pageUrl); const threadId = id();
      data.threads[threadId] = { id: threadId, stepId: owner.id, title, description: command.description, ...link, resolved: false, createdAt: now, updatedAt: now };
      owner.threadIds.push(threadId); owner.updatedAt = now; touchPlan(owner.planId); break;
    }
    case 'editThread':
    case 'resolveThread':
    case 'deleteThread': {
      const value = data.threads[command.id]; if (!value) throw new Error('Issue missing');
      const owner = step(value.stepId);
      if (command.type === 'deleteThread') {
        owner.threadIds = owner.threadIds.filter(key => key !== value.id); delete data.threads[value.id];
      } else if (command.type === 'resolveThread') {
        if (typeof command.resolved !== 'boolean') throw new Error('Invalid resolved status');
        value.resolved = command.resolved; value.updatedAt = now;
      } else {
        const title = required(command.title, 240);
        if (typeof command.description !== 'string' || command.description.length > 10000) throw new Error('Invalid description');
        const link = threadLink(command.pageUrl);
        value.title = title; value.description = command.description;
        delete value.pageUrl; delete value.conversationId;
        Object.assign(value, link); value.updatedAt = now;
      }
      owner.updatedAt = now; touchPlan(owner.planId); break;
    }
    case 'moveStep': {
      if (command.direction !== -1 && command.direction !== 1) throw new Error('Invalid direction');
      const value = step(command.id); const owner = plan(value.planId); const index = owner.stepIds.indexOf(value.id); const next = index + command.direction;
      if (index < 0) throw new Error('Step order missing');
      if (next < 0 || next >= owner.stepIds.length) break;
      if (step(owner.stepIds[next]).phaseId !== value.phaseId) break;
      [owner.stepIds[index], owner.stepIds[next]] = [owner.stepIds[next], owner.stepIds[index]];
      owner.stepIds.forEach((key, order) => { if (step(key).order !== order) { step(key).order = order; step(key).updatedAt = now; } });
      touchPlan(owner.id); break;
    }
    case 'deleteStep': {
      const value = step(command.id); const owner = touchPlan(value.planId);
      owner.stepIds = owner.stepIds.filter(key => key !== value.id);
      for (const thread of Object.values(data.threads)) if (thread.stepId === value.id) delete data.threads[thread.id];
      for (const binding of Object.values(data.conversationBindings)) if (binding.currentStepId === value.id) { delete binding.currentStepId; binding.updatedAt = now; }
      for (const link of Object.values(data.sourceLinks)) if (link.stepId === value.id) {
        delete data.sourceLinks[link.id];
        if (!Object.values(data.sourceLinks).some(other => other.sourceId === link.sourceId)) delete data.sources[link.sourceId];
      }
      delete data.steps[value.id];
      owner.stepIds.forEach((key, order) => { if (step(key).order !== order) { step(key).order = order; step(key).updatedAt = now; } });
      break;
    }
    default: throw new Error('Unknown command');
  }
  return data;
}
