export type StepStatus = 'todo' | 'current' | 'done' | 'blocked';
export interface Project { id: string; name: string; description?: string; activePlanId: string | null; createdAt: string; updatedAt: string }
export interface Plan { id: string; projectId: string; title: string; goal?: string; completionCriteria?: string; phaseIds: string[]; description?: string; markdownSource: string; stepIds: string[]; createdAt: string; updatedAt: string }
export interface Phase { id: string; planId: string; title: string; createdAt: string; updatedAt: string }
export interface Step { id: string; planId: string; phaseId: string; key: string; title: string; status: StepStatus; order: number; instructions?: string; commands?: string; completionCriteria?: string; notes?: string; threadIds: string[]; createdAt: string; updatedAt: string }
export interface Thread { id: string; stepId: string; title: string; description?: string; conversationId?: string; pageUrl?: string; resolved: boolean; createdAt: string; updatedAt: string }
export interface ConversationBinding { conversationId: string; projectId: string; planId: string; currentStepId?: string; pageUrl: string; createdAt: string; updatedAt: string }
export interface GuideRailStorage {
  version: 3;
  phases: Record<string, Phase>;
  sources: Record<string, MessageSource>; sourceLinks: Record<string, SourceLink>;
  projects: Record<string, Project>; plans: Record<string, Plan>; steps: Record<string, Step>;
  threads: Record<string, Thread>; conversationBindings: Record<string, ConversationBinding>;
  selectedProjectId: string | null;
}
export function emptyStorage(): GuideRailStorage {
  return { version: 3, phases: {}, sources: {}, sourceLinks: {}, projects: {}, plans: {}, steps: {}, threads: {}, conversationBindings: {}, selectedProjectId: null };
}
export type Command =
  | { type: 'saveReply'; capture: Capture }
  | { type: 'deleteReplies'; ids: string[] }
  | { type: 'clearAll'; expectedSource: string }
  | { type: 'renameReply'; id: string; title: string }
  | { type: 'editGoal'; planId: string; goal: string; completionCriteria: string }
  | { type: 'createPhase'; planId: string; title: string }
  | { type: 'renamePhase'; id: string; title: string }
  | { type: 'movePhase'; id: string; direction: -1 | 1 }
  | { type: 'deletePhase'; id: string }
  | { type: 'assignPhase'; stepId: string; phaseId: string }
  | { type: 'importOutline'; planId: string; source: string; applyGoal: boolean }

  | { type: 'captureMessage'; capture: Capture; planId: string; stepId?: string; title?: string; replaceSnapshot?: boolean }
  | { type: 'unlinkSource'; id: string }
  | { type: 'categorizeSource'; id: string; category: SourceLink['category'] }
  | { type: 'importMarkdown'; planId: string; source: string }
  | { type: 'restoreBackup'; data: unknown; expectedSource: string }
  | { type: 'createProject'; name: string; conversation?: { conversationId: string; pageUrl: string } }
  | { type: 'bindConversation'; conversationId: string; pageUrl: string; projectId: string; planId: string }
  | { type: 'renameProject'; id: string; name: string }
  | { type: 'selectProject'; id: string }
  | { type: 'renamePlan'; id: string; title: string }
  | { type: 'createStep'; phaseId?: string; planId: string; key: string; title: string; instructions?: string; commands?: string; completionCriteria?: string }
  | { type: 'editStep'; id: string; key: string; title: string; notes: string; instructions?: string; commands?: string; completionCriteria?: string }
  | { type: 'deleteStep'; id: string }
  | { type: 'moveStep'; id: string; direction: -1 | 1 }
  | { type: 'createThread'; stepId: string; title: string; description: string; pageUrl?: string }
  | { type: 'editThread'; id: string; title: string; description: string; pageUrl?: string }
  | { type: 'resolveThread'; id: string; resolved: boolean }
  | { type: 'deleteThread'; id: string }
  | { type: 'completeAndAdvance'; id: string; expectedNextStepId: string | null; acknowledgeIssues: boolean }
  | { type: 'setStatus'; id: string; status: StepStatus };

export interface MessageSource { title?: string; html?: string; id: string; conversationId: string; messageId: string; role: 'assistant' | 'user'; pageUrl: string; text: string; createdAt: string; updatedAt: string }
export interface SourceLink { id: string; sourceId: string; stepId: string; category: 'operation' | 'troubleshooting' | 'conclusion'; createdAt: string; updatedAt: string }
export type Capture = Pick<MessageSource, 'conversationId' | 'messageId' | 'role' | 'pageUrl' | 'text' | 'html'>;
