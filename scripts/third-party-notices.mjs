import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const packages = ['react', 'react-dom', 'scheduler', 'turndown', 'turndown-plugin-gfm'];
const notices = packages.map(name => {
  const base = `node_modules/${name}`;
  const { version } = JSON.parse(readFileSync(`${base}/package.json`, 'utf8'));
  return `${name} ${version}\n\n${readFileSync(`${base}/LICENSE`, 'utf8')}`;
});
writeFileSync('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n\n--------------------\n\n'));
copyFileSync('LICENSE', 'dist/LICENSE');
