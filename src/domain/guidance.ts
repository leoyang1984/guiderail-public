import type { GuideRailStorage, Plan } from '../storage/schema';

/** Follow displayed order, returning to earlier unfinished work only at the end. */
export function getGuidance(data: GuideRailStorage, plan: Plan) {
  const steps = plan.stepIds.map(id => data.steps[id]);
  const current = steps.find(step => step.status === 'current');
  const currentIndex = current ? steps.indexOf(current) : -1;
  const next = current
    ? [...steps.slice(currentIndex + 1), ...steps.slice(0, currentIndex)].find(step => step.status !== 'done')
    : steps.find(step => step.status !== 'done');
  const unresolved = current ? current.threadIds.filter(id => data.threads[id] && !data.threads[id].resolved).length : 0;
  return { current, next, currentIndex, unresolved, completed: steps.filter(step => step.status === 'done').length, total: steps.length,
    returning: !!current && !!next && steps.indexOf(next) < currentIndex };
}
