import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
import { SAMPLE } from '../apps/playground/src/sample';
let server: ViteDevServer;
let url: string;
test.beforeAll(async () => {
  server = await createPlaygroundServer();
  await server.listen();
  url = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => { await server?.close(); });

test('legacy visible labels, units, inputs and slider values stay together on phones and inline on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  await page.locator('#source').fill(SAMPLE
    .replace('Deposit :edit[Deposit]{input=principal}, at :slider[Rate (%/year)]{input=rate step=0.5}% per year\nfor :edit[Term (years)]{input=years step=1} years.',
      ':input[principal]{label="Deposit"} :input[rate]{label="Rate (%/year)" widget=slider step=0.5}\n:input[years]{label="Term (years)" step=1}'));
  await page.locator('#mode-view').click();
  const controls = page.locator('#doc p > .active-input').filter({ has: page.locator('.active-input-label') });
  await expect(controls).toHaveCount(3);
  await expect(page.locator('[data-active-input="principal"]')).toHaveAccessibleName('Deposit');
  await expect(page.locator('[data-active-input="years"]')).toHaveAccessibleName('Term (years)');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = await controls.evaluateAll(labels => labels.map(label => {
      const l = label.getBoundingClientRect();
      const children = [...label.children].map(child => child.getBoundingClientRect());
      return { y: l.y, bottom: l.bottom, fits: children.every(child => child.left >= l.left - 1 && child.right <= l.right + 1 && child.top >= l.top - 1 && child.bottom <= l.bottom + 1) };
    }));
    expect(boxes.every(box => box.fits)).toBe(true);
    expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.bottom);
    expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.bottom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const rate = page.locator('[data-active-input="rate"]');
  await rate.focus(); await rate.press('ArrowRight');
  await expect(page.locator('output[data-active-value="rate"]')).toHaveText('8.5');
  const years = page.locator('[data-active-input="years"]');
  await years.focus(); await years.press('ArrowUp'); await expect(years).toHaveValue('11');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(controls.first()).toHaveCSS('display', 'inline-flex');
  const rows = await controls.evaluateAll(labels => labels.map(label => ({ top: label.getBoundingClientRect().top, bottom: label.getBoundingClientRect().bottom })));
  expect(Math.max(...rows.map(row => row.top))).toBeLessThan(Math.min(...rows.map(row => row.bottom)));
});
