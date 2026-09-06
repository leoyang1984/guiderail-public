import type { GuideRailStorage } from '../storage/schema';
export function isChatGPTUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'chatgpt.com' && !url.port && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function getChatGPTConversationId(value: string): string | null {
  if (!isChatGPTUrl(value)) return null;
  return new URL(value).pathname.match(/^\/c\/([a-zA-Z0-9_-]+)\/?$/)?.[1] ?? null;
}

/** Resolve per-conversation context without changing shared storage on tab switches. */
export function resolveConversation(data: GuideRailStorage, conversationId: string | null) {
  const binding = conversationId ? data.conversationBindings[conversationId] : undefined;
  const projectId = binding?.projectId ?? data.selectedProjectId;
  const project = projectId ? data.projects[projectId] : undefined;
  const planId = binding?.planId ?? project?.activePlanId;
  const plan = planId ? data.plans[planId] : undefined;
  const currentStepId = plan?.stepIds.find(id => data.steps[id]?.status === 'current');
  return { binding, project, plan, currentStepId };
}
