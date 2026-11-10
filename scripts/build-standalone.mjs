/**
 * 產生根目錄的 index.html：把 dist 的 JS / CSS 全部內嵌成單一 HTML。
 * 下載 repo ZIP 後直接雙擊 index.html 就能使用，不需要 Node、不需要伺服器。
 *
 * 用法：npm run build:standalone
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const assetsDir = resolve(distDir, 'assets');

const html = readFileSync(resolve(distDir, 'index.html'), 'utf8');
const assets = readdirSync(assetsDir);
const jsName = assets.find((file) => file.endsWith('.js'));
const cssName = assets.find((file) => file.endsWith('.css'));

if (!jsName || !cssName) {
  throw new Error('找不到 dist 的 JS/CSS，請先執行 npm run build。');
}

// 內嵌到 <script> 前要先跳脫 </script>
const js = readFileSync(resolve(assetsDir, jsName), 'utf8').replace(/<\/script>/gi, '<\\/script>');
const css = readFileSync(resolve(assetsDir, cssName), 'utf8');

let output = html
  // module script 拿掉，改成 body 最後的一般 script（file:// 可直接執行）
  .replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/, '')
  .replace(
    /<link rel="stylesheet"[^>]*href="[^"]*"[^>]*>/,
    () => `<style>\n${css}\n</style>`,
  )
  // 用 function 回傳，避免 JS 內的 $& / $' 被 String.replace 當成替換語法
  .replace('</body>', () => `<script>\n${js}\n</script>\n</body>`);

if (output.includes('src="./assets/') || output.includes('href="./assets/')) {
  throw new Error('仍有外部 asset 參照，內嵌失敗。');
}

const target = resolve(root, 'index.html');
writeFileSync(
  target,
  `<!-- 此檔由 npm run build:standalone 自動產生，請勿直接編輯；原始頁面在 dev.html -->\n${output}`,
);
console.log(`index.html 已產生（${(output.length / 1024).toFixed(0)} KB）`);
