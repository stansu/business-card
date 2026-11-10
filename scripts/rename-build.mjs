/** Vite 以 dev.html 為入口，build 後改名為 index.html 供 GitHub Pages 使用。 */
import { existsSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist/dev.html');
const target = resolve(root, 'dist/index.html');

if (!existsSync(source)) {
  throw new Error('找不到 dist/dev.html，請先執行 vite build。');
}
renameSync(source, target);
console.log('dist/dev.html → dist/index.html');
