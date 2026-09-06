import { readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

// Explicit publishing boundary: neither Git history nor arbitrary root files are included.
const roots = new Set(['README.md', 'DEVELOPMENT.md', 'LICENSE', 'CONTRIBUTING.md', '.gitignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'src', 'public', 'scripts', 'tests', 'docs']);
export function publicFiles() {
  const files = [];
  function walk(path) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Symlink requires review: ${path}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) walk(join(path, name));
    } else if (stat.isFile()) files.push(path);
  }
  for (const name of readdirSync('.').sort()) if (roots.has(name)) walk(name);
  return files;
}
