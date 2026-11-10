import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// 範例 Excel 直接內嵌成 data URI，讓單檔版（index.html）與正式站都能下載，
// 不需要額外的檔案。
const sample = readFileSync(new URL('./public/sample-employees.xlsx', import.meta.url));
const sampleDataUrl =
  'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' +
  sample.toString('base64');

// GitHub Pages 專案站台會位於 /<repo>/ 之下，
// 使用相對路徑（base: './'）可同時支援本機與 Pages，不需修改 repo 名稱。
export default defineConfig({
  base: './',
  define: {
    __SAMPLE_XLSX__: JSON.stringify(sampleDataUrl),
  },
  server: {
    open: '/dev.html',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: 'dev.html',
    },
  },
});
