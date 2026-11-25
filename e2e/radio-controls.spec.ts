import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
import { readFile } from 'node:fs/promises';

let server: ViteDevServer;
test.beforeAll(async () => { server = await createPlaygroundServer(); await server.listen(); });
test.afterAll(async () => { await server?.close(); });

test('native radios support keyboard, visible labels and independent groups at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(server.resolvedUrls!.local[0]!);
  const source = (await readFile(new URL('../examples/radio-control.md', import.meta.url), 'utf8'))
    .replace('[Express (+{{value}})]', '[Express (+{{value}}) — Доставка 🚚 with a long shipping option description]');
  const paths = {
    remark: '/@fs' + new URL('../packages/remark/src/index.ts', import.meta.url).pathname,
    runtime: '/@fs' + new URL('../packages/runtime/src/index.ts', import.meta.url).pathname,
  };
  await page.evaluate(async ({ paths, source }) => {
    const { renderActive } = await import(paths.remark) as typeof import('../packages/remark/src/index.js');
    const { mount } = await import(paths.runtime) as typeof import('../packages/runtime/src/index.js');
    for (const id of ['first', 'second']) {
      const root = document.createElement('div');
      root.id = id;
      root.innerHTML = renderActive(source).html;
      document.body.append(root);
      mount(root);
    }
  }, { paths, source });
  const first = page.locator('#first').getByRole('group', { name: 'Delivery' });
  const second = page.locator('#second').getByRole('group', { name: 'Delivery' });
  await expect(first.getByRole('radio', { name: 'Standard (+10)', exact: true })).toBeChecked();
  await first.getByRole('radio', { name: 'Standard (+10)', exact: true }).press('ArrowRight');
  await expect(first.getByRole('radio', { name: /^Express \(\+25\)/ })).toBeChecked();
  await expect(page.locator('#first output')).toHaveText('125');
  await expect(second.getByRole('radio', { name: 'Standard (+10)', exact: true })).toBeChecked();
  await first.getByRole('radio', { name: 'Pickup (+0)', exact: true }).check();
  await expect(page.locator('#first').getByRole('spinbutton')).toHaveValue('0');
  expect(await first.evaluate(group => group.scrollWidth <= group.clientWidth)).toBe(true);
});
