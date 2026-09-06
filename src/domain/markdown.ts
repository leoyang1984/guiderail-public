export interface ChecklistStep { key: string; title: string; status: 'todo' | 'done'; instructions?: string; commands?: string; completionCriteria?: string }
export function parseChecklist(source: string, existingKeys: string[] = []): ChecklistStep[] {
  if (typeof source !== 'string' || source.length > 200000) throw new Error('清单过长，请分批导入。');
  const used = new Set(existingKeys.map(key => key.toLowerCase()));
  type Row = Omit<ChecklistStep, 'key'> & { key?: string };
  const rows: Row[] = [];
  let field: 'instructions' | 'commands' | 'completionCriteria' = 'instructions';
  let current: Row | undefined;
  let fence: string | null = null;
  // Accept a whole checklist copied from a Markdown code block.
  const body = source.trim().replace(/^```(?:markdown|md)?\s*\n([\s\S]*)\n```$/i, '$1');
  const append = (target: typeof field, text: string) => {
    if (current) current[target] = (current[target] === undefined ? '' : current[target] + '\n') + text;
  };
  for (const line of body.split(/\r?\n/)) {
    const fenceMatch = line.trim().match(/^(`{3,}|~{3,})/);
    if (fence) {
      if (line.trim().startsWith(fence)) { fence = null; continue; }
      append('commands', line); continue;
    }
    if (fenceMatch) { fence = fenceMatch[1]; continue; }
    const match = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (match) {
      const explicit = match[2].match(/^(STEP-\d+)\s+(.+)$/i);
      const key = explicit?.[1]; const title = explicit?.[2] ?? match[2];
      if (title.length > 240 || (key && key.length > 40)) throw new Error('步骤标题或编号过长。');
      if (key) { if (used.has(key.toLowerCase())) throw new Error(`编号 ${key} 已存在，请修改后导入。`); used.add(key.toLowerCase()); }
      current = { key, title, status: match[1].toLowerCase() === 'x' ? 'done' : 'todo' };
      rows.push(current); field = 'instructions'; continue;
    }
    if (!current) continue;
    const label = line.trim().match(/^(?:#{1,6}\s*)?(操作说明|命令|完成标准)(?:\s*[：:]\s*(.*)|\s*)$/);
    if (label) {
      field = label[1] === '命令' ? 'commands' : label[1] === '完成标准' ? 'completionCriteria' : 'instructions';
      if (label[2]) append(field, label[2]);
    } else append(field, line);
  }
  if (!rows.length) throw new Error('未找到清单，请使用 - [ ] 或 - [x] 开头的步骤。');
  if (rows.length > 1000) throw new Error('一次最多导入 1000 个步骤。');
  let next = 1;
  return rows.map(row => {
    let key = row.key;
    if (!key) {
      while (used.has(`step-${String(next).padStart(2, '0')}`)) next++;
      key = `STEP-${String(next++).padStart(2, '0')}`; used.add(key.toLowerCase());
    }
    for (const name of ['instructions', 'commands', 'completionCriteria'] as const) {
      const value = row[name]?.trim();
      if (value && value.length > 10000) throw new Error('单步详情过长，请拆分步骤。');
      if (value) row[name] = value; else delete row[name];
    }
    return { ...row, key };
  });
}
