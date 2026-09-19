import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  join(here, 'node_modules/vite/bin/vite.js'),
  join(here, '../../node_modules/vite/bin/vite.js')
];
const viteJs = candidates.find(existsSync);
if (!viteJs) {
  console.error('vite not found. looked in:');
  for (const c of candidates) console.error(' -', c);
  process.exit(1);
}
const result = spawnSync(process.execPath, [viteJs, 'build'], {
  cwd: here,
  stdio: 'inherit',
  env: process.env
});
process.exit(result.status === null ? 1 : result.status);
