import { expect, test } from '@playwright/test';
import { createPlaygroundServer } from './playground-server';

test('concurrent playground servers retain independent optimized modules', async ({ browser }) => {
  const servers = await Promise.all([createPlaygroundServer(), createPlaygroundServer()]);
  const contexts = await Promise.all(servers.map(() => browser.newContext()));
  try {
    expect(servers[0]!.config.cacheDir).not.toBe(servers[1]!.config.cacheDir);
    await Promise.all(servers.map(server => server.listen()));
    await Promise.all(servers.map(async (server, i) => {
      const page = await contexts[i]!.newPage();
      const errors: string[] = [];
      page.on('response', response => { if (response.status() >= 400) errors.push(String(response.status()) + ' ' + new URL(response.url()).pathname); });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(server.resolvedUrls!.local[0]!);
      await expect(page.locator('#source')).not.toHaveValue('');
      await page.reload();
      await expect(page.locator('#source')).not.toHaveValue('');
      expect(errors).toEqual([]);
    }));
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await Promise.all(servers.map(server => server.close()));
  }
});
