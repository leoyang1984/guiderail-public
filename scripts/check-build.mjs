import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, JSON.parse(await readFile('package.json', 'utf8')).version);
await access('dist/LICENSE');
await access('dist/THIRD_PARTY_NOTICES.txt');
await access(`dist/${manifest.background.service_worker}`);
const html = await readFile(`dist/${manifest.side_panel.default_path}`, 'utf8');
assert(!html.includes('.tsx'), 'Uncompiled source in extension HTML');
for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  await access(new URL(asset, new URL(`../dist/${manifest.side_panel.default_path}`, import.meta.url)));
}
console.log('Extension manifest and bundled entry points verified.');

for (const script of manifest.content_scripts ?? []) for (const file of script.js) { const text = await readFile(`dist/${file}`, 'utf8'); assert(!/\bimport\s*(?:\{|[\"'])/.test(text), 'Content script must be self-contained'); }
