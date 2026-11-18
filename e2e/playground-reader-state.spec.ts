import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
let server: ViteDevServer;
let url: string;
test.beforeAll(async () => {
  server = await createPlaygroundServer();
  await server.listen();
  url = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => { await server?.close(); });

test('mode switches preserve accepted values; reset and recipients use authored defaults', async ({ page, context }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const source = await page.locator('#source').inputValue();
  await page.locator('#mode-view').click();
  const years = page.locator('[data-active-input="years"]');
  await years.fill('20');
  await years.fill('0'); // Only the last accepted value survives a remount.
  await page.locator('#mode-edit').click();
  await expect(page.locator('#source')).toHaveValue(source);
  await page.locator('#mode-view').click();
  await expect(years).toHaveValue('20');
  await expect(page.locator('output[data-active-value="final"]')).toContainText('46');
  await page.locator('#share').click();
  await expect(page).toHaveURL(/#doc=/);
  await expect(page.locator('#status')).toContainText('authored defaults');
  const recipient = await context.newPage();
  await recipient.goto(page.url());
  await expect(recipient.locator('[data-active-input="years"]')).toHaveValue('10');
  await recipient.close();
  await page.locator('#reset-values').click();
  await expect(years).toHaveValue('10');
  await years.fill('20');
  await page.locator('#mode-edit').click();
  await page.locator('#source').fill(source + '\n\nChanged source');
  await page.locator('#mode-view').click();
  await expect(years).toHaveValue('10');
  await years.fill('20');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#sample').click();
  await expect(years).toHaveValue('10');
});
