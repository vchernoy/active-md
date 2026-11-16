import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
let server: ViteDevServer;
let url: string;
test.beforeAll(async () => {
  server = await createServer({ root: new URL('../apps/playground', import.meta.url).pathname, server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  url = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => { await server?.close(); });

test('wide display formulas advertise scrolling at 390px and support keyboard access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const text = '$$a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t=u$$';
  await page.locator('#source').fill(text);
  await page.locator('#mode-view').click();
  const formula = page.locator('.active-math-display');
  const hint = page.locator('#math-scroll-hint');
  await expect(hint).toBeVisible();
  await expect(formula).toHaveAttribute('tabindex', '0');
  await expect(formula).toHaveAccessibleName('Scrollable formula');
  await expect(formula).toHaveAttribute('aria-describedby', 'math-scroll-hint');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await formula.focus(); await formula.press('ArrowRight');
  await expect.poll(() => formula.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(hint).toBeHidden();
  await expect(formula).not.toHaveAttribute('tabindex');
  await page.locator('#mode-edit').click();
  await page.locator('#source').fill('$$x=1$$');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#mode-view').click();
  await expect(hint).toBeHidden();
  await expect(formula).not.toHaveAttribute('tabindex');
});
