import { defineConfig } from 'vite';

// GitHub Pages 專案站台會位於 /<repo>/ 之下，
// 使用相對路徑（base: './'）可同時支援本機與 Pages，不需修改 repo 名稱。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
