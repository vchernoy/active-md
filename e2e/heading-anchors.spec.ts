import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
let server: ViteDevServer;
test.beforeAll(async () => { server = await createPlaygroundServer(); await server.listen(); });
test.afterAll(async () => { await server?.close(); });

test('native heading and footnote links reach sanitized targets without host click handlers', async ({ page }) => {
  await page.goto(server.resolvedUrls!.local[0]!);
  const paths = { remark: '/@fs' + new URL('../packages/remark/src/index.ts', import.meta.url).pathname };
  await page.evaluate(async ({ remark }) => {
    const { renderActive } = await import(remark) as typeof import('../packages/remark/src/index.js');
    document.body.innerHTML = renderActive('[Jump](#later) [Again](#later-1) [Unicode](#%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82)\n\n## Later\n\n## Later\n\n## Привет\n\nNote[^a].\n\n[^a]: Footnote.').html;
  }, paths);
  for (const [name, id] of [['Jump', 'user-content-later'], ['Again', 'user-content-later-1'], ['Unicode', 'user-content-привет']]) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.locator(':target')).toHaveAttribute('id', id);
  }
  await page.locator('a[data-footnote-ref]').click();
  await expect(page.locator(':target')).toHaveJSProperty('tagName', 'LI');
  await page.locator('a[data-footnote-backref]').click();
  await expect(page.locator(':target')).toHaveJSProperty('tagName', 'A');
});
