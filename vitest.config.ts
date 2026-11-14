import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Test packages against each other's sources, not stale builds.
    alias: { '@vchernoy/calc': fileURLToPath(new URL('./packages/calc/src/index.ts', import.meta.url)) },
  },
});
