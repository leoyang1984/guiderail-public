import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { publicFiles } from './public-files.mjs';

const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['credential', /(?:gh[pousr]_[A-Za-z0-9_]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{15,})/g],
  ['secret-assignment', /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password|passwd)\s*[:=]\s*["'][^"'\r\n]{8,}["']/gi],
  ['local-user-path', /\/(?:Users|home)\/[A-Za-z0-9._-]+/g],
  ['personal-email', /[A-Z0-9._%+-]+@(?:qq\.com|gmail\.com|outlook\.com|hotmail\.com|icloud\.com|163\.com)/gi],
  ['real-conversation', /chatgpt\.com\/c\/[a-f0-9]{8}-[a-f0-9-]{27,}/gi],
  ['url-password', /https?:\/\/[^\s/@:]+:[^\s/@]+@/g],
];
let count = 0, findings = 0;
function scan(name, buffer) {
  count++;
  if (/(?:^|\/)(?:\.env(?:\..*)?|[^/]+\.(?:pem|key|p12|pfx)|guiderail-backup-[^/]+\.json)$/.test(name)) {
    console.error(`${name}: sensitive filename requires review`); findings++;
  }
  if (buffer.includes(0)) { console.error(`${name}: binary requires manual review`); findings++; return; }
  const text = buffer.toString('utf8');
  for (const [label, pattern] of rules) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      console.error(`${name}:${text.slice(0, match.index).split('\n').length}: ${label}`);
      findings++;
    }
  }
}
if (process.argv.includes('--history')) {
  const git = args => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
  scan('commit-metadata', git(['log', '--all', '--format=%an <%ae> %cn <%ce>%n%B']));
  for (const row of git(['rev-list', '--objects', '--all']).toString().trim().split('\n')) {
    const [id, ...path] = row.split(' ');
    if (git(['cat-file', '-t', id]).toString().trim() === 'blob') scan(`history:${id.slice(0, 8)}:${path.join(' ')}`, git(['cat-file', 'blob', id]));
  }
} else {
  const files = new Set(publicFiles());
  // Also inspect tracked working files outside the release allowlist when Git is present.
  if (existsSync('.git')) {
    for (const file of execFileSync('git', ['ls-files', '-z']).toString().split('\0')) if (file && existsSync(file)) files.add(file);
  }
  for (const file of files) scan(file, readFileSync(file));
}
console.log(`Scanned ${count} entries; ${findings} findings. Pattern scan is not a guarantee of absence.`);
process.exitCode = findings ? 1 : 0;
