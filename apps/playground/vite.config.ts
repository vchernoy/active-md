import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

export default defineConfig({
  // GitHub Pages serves the site under /active-md/; set BASE there.
  base: process.env.BASE ?? '/',
  resolve: {
    alias: {
      '@vchernoy/calc': src('calc/src/index.ts'),
      '@vchernoy/remark-active/tex': src('remark/src/tex.ts'),
      '@vchernoy/remark-active': src('remark/src/index.ts'),
      '@vchernoy/active-runtime/style.css': src('runtime/style.css'),
      '@vchernoy/active-runtime/sketch.css': src('runtime/sketch.css'),
      '@vchernoy/active-runtime': src('runtime/src/index.ts'),
    },
  },
  build: { target: 'es2022' },
});
