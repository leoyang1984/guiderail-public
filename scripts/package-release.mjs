import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, lstatSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { publicFiles } from './public-files.mjs';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
mkdirSync('release', { recursive: true });
const staging = mkdtempSync(resolve('release/staging-'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
try {
  const source = `${staging}/GuideRail-${version}`;
  mkdirSync(source);
  for (const file of publicFiles()) {
    mkdirSync(dirname(`${source}/${file}`), { recursive: true });
    cpSync(file, `${source}/${file}`);
  }
  const sourceZip = resolve(`release/GuideRail-${version}-source-${stamp}.zip`);
  execFileSync('zip', ['-X', '-q', '-r', sourceZip, `GuideRail-${version}`], { cwd: staging });
  const extensionZip = resolve(`release/GuideRail-${version}-chrome-${stamp}.zip`);
  // dist is freshly produced by release:local; reject symlinks before packaging.
  function check(path) {
    if (lstatSync(path).isSymbolicLink()) throw new Error('Unexpected symlink in dist');
    if (lstatSync(path).isDirectory()) for (const name of readdirSync(path)) check(`${path}/${name}`);
  }
  check('dist');
  execFileSync('zip', ['-X', '-q', '-r', extensionZip, '.'], { cwd: resolve('dist') });
  console.log(`Source (no Git history): ${sourceZip}\nChrome extension: ${extensionZip}`);
} finally {
  // Only remove this invocation's temporary staging directory.
  rmSync(staging, { recursive: true });
}
