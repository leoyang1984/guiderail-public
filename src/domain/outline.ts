import { parseChecklist, type ChecklistStep } from './markdown';
export interface Outline { goal?: string; completionCriteria?: string; phases: { title: string; steps: ChecklistStep[] }[]; unassigned: string }
export const PLANNING_PROMPT = `请把我们已经讨论过的任务整理为执行计划。不要虚构已经完成的工作，不确定处写“待确认”。只把明确的行动列为步骤。使用以下 Markdown 格式，不要用代码块包裹整份计划：
总目标：一句话说明最终要达到什么
目标完成条件：如何验证整体完成
## 阶段一：阶段名称
- [ ] 具体步骤标题
操作说明：当前应该做什么
完成标准：如何知道这一步完成
## 阶段二：阶段名称
- [ ] 下一项具体行动
需要命令时，在对应步骤下用代码块列出。已经确定完成的步骤才标 [x]。不要把操作说明中的子列表当成独立步骤。`;
/** Conservative structural parser: content is never executed or treated as instructions to the extension. */
export function parseOutline(source: string, existingKeys: string[] = []): Outline {
  if (typeof source !== 'string' || source.length > 200000) throw new Error('计划过长，请分批导入。');
  const body = source.trim().replace(/^```(?:markdown|md)?\s*\n([\s\S]*)\n```$/i, '$1');
  const groups: { title: string; lines: string[]; count: number }[] = [];
  const unused: string[] = []; let group: typeof groups[number] | undefined; let fence: string | null = null;
  let goal: string | undefined; let completionCriteria: string | undefined;
  const start = (title: string) => { if (title.length > 180) throw new Error('阶段标题过长。'); group = { title, lines: [], count: 0 }; groups.push(group); };
  for (const line of body.split(/\r?\n/)) {
    const marker = line.trim().match(/^(`{3,}|~{3,})/)?.[1];
    if (fence || marker) {
      if (group?.count) group.lines.push(line); else unused.push(line);
      if (!fence) fence = marker!; else if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    const meta = line.match(/^(?:#{1,2}\s+)?(总目标|目标完成条件)[：:]\s*(.+)$/);
    if (meta && !groups.some(item => item.count)) { if (meta[2].length > 10000) throw new Error('目标说明过长。'); if (meta[1] === '总目标') goal = meta[2]; else completionCriteria = meta[2]; continue; }
    const phase = line.match(/^##\s+(.+)$/)?.[1] ?? line.match(/^(第[一二三四五六七八九十百\d]+阶段\s*[：:].+)$/)?.[1];
    if (phase && !/^(操作说明|命令|完成标准)/.test(phase)) { start(phase); continue; }
    const checklist = line.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)、]\s*(\S.*)$/)?.[1];
    const heading = line.match(/^###\s+(?:步骤\s*\d+\s*[：:]?\s*)?(.+)$/)?.[1];
    if (checklist || numbered || (heading && !/^(操作说明|命令|完成标准)/.test(heading))) {
      if (!group) start('导入阶段');
      group!.lines.push(checklist ? line : `- [ ] ${numbered ?? heading}`); group!.count++; continue;
    }
    if (group?.count) group.lines.push(/^\s+[-*+]\s+\[[ xX]\]/.test(line) ? line.replace(/^(\s*)/, '$1\\') : line); else if (line.trim()) unused.push(line);
  }
  if (fence) throw new Error('代码块尚未闭合，请检查原文。');
  if (!groups.some(item => item.count)) throw new Error('未找到明确步骤。请使用编号、- [ ] 清单或 ### 步骤标题；可先复制整理提示词。');
  // Allocate keys across the entire document so later explicit keys cannot collide with earlier automatic ones.
  const rows = parseChecklist(groups.map(item => item.lines.join('\n')).join('\n'), existingKeys);
  let offset = 0;
  return { goal, completionCriteria, unassigned: unused.join('\n'), phases: groups.map(item => { const steps = rows.slice(offset, offset + item.count); offset += item.count; return { title: item.title, steps }; }) };
}
