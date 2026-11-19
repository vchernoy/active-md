import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
let server: ViteDevServer;
test.beforeAll(async () => { server = await createPlaygroundServer(); await server.listen(); });
test.afterAll(async () => { await server?.close(); });

test('current playground sample uses readable controls and live travel/lodging choices', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(server.resolvedUrls!.local[0]!);
  await page.locator('#mode-view').click();
  await expect(page.getByRole('spinbutton', { name: 'Deposit', exact: true })).toHaveValue('10000');
  const rate = page.getByRole('slider', { name: 'Rate (%/year)', exact: true });
  await rate.focus(); await rate.press('ArrowRight');
  await expect(rate).toHaveValue('8.5');
  await page.getByRole('radio', { name: 'Train — 800', exact: true }).check();
  await expect(page.locator('output[data-active-value="share"]')).toHaveText('8,600');
  await page.getByRole('combobox', { name: 'Room rate per night' }).selectOption('8000');
  await expect(page.getByRole('spinbutton', { name: 'Room price', exact: true })).toHaveValue('8000');
  await expect(page.locator('output[data-active-value="share"]')).toHaveText('12,800');
  await page.getByRole('spinbutton', { name: 'Room price', exact: true }).fill('3500');
  await expect(page.getByRole('combobox', { name: 'Room rate per night' })).toHaveValue('3500');
  await expect(page.locator('output[data-active-value="share"]')).toHaveText('6,050');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
