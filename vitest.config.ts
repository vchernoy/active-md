import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'] },
  resolve: {
    // Test packages against each other's sources, not stale builds.
    alias: {
      '@vchernoy/calc': fileURLToPath(new URL('./packages/calc/src/index.ts', import.meta.url)),
      '@vchernoy/remark-active/tex': fileURLToPath(new URL('./packages/remark/src/tex.ts', import.meta.url)),
      '@vchernoy/remark-active': fileURLToPath(new URL('./packages/remark/src/index.ts', import.meta.url)),
    },
  },
});
