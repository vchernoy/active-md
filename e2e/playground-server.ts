import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

/** Concurrent fixtures must not invalidate each other's optimized dependencies. */
export async function createPlaygroundServer() {
  const cacheDir = await mkdtemp(join(tmpdir(), 'active-md-playground-'));
  try {
    const server = await createServer({ cacheDir, root: new URL('../apps/playground', import.meta.url).pathname,
      server: { host: '127.0.0.1', port: 0 } });
    const close = server.close.bind(server);
    server.close = async () => { try { await close(); } finally { await rm(cacheDir, { recursive: true, force: true }); } };
    return server;
  } catch (error) { await rm(cacheDir, { recursive: true, force: true }); throw error; }
}
