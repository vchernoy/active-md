import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'] },
  resolve: {
    // Test packages against each other's sources, not stale builds.
    alias: {
      '@vchernoy/active-runtime/style.css': fileURLToPath(new URL('./packages/runtime/style.css', import.meta.url)),
      '@vchernoy/active-runtime/styles.css': fileURLToPath(new URL('./packages/runtime/styles.css', import.meta.url)),
      '@vchernoy/active-runtime/sketch.css': fileURLToPath(new URL('./packages/runtime/sketch.css', import.meta.url)),
      '@vchernoy/active-runtime': fileURLToPath(new URL('./packages/runtime/src/index.ts', import.meta.url)),
      '@vchernoy/calc': fileURLToPath(new URL('./packages/calc/src/index.ts', import.meta.url)),
      '@vchernoy/remark-active/tex': fileURLToPath(new URL('./packages/remark/src/tex.ts', import.meta.url)),
      '@vchernoy/remark-active': fileURLToPath(new URL('./packages/remark/src/index.ts', import.meta.url)),
    },
  },
});
