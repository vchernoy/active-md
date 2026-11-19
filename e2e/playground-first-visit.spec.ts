import { expect, test } from '@playwright/test';
import { createPlaygroundServer } from './playground-server';

let server: Awaited<ReturnType<typeof createPlaygroundServer>>;
let url: string;
test.beforeAll(async () => { server = await createPlaygroundServer(); await server.listen(); url = server.resolvedUrls!.local[0]!; });
test.afterAll(async () => { await server.close(); });

test('a first visit shows the example working; a saved document reopens for editing', async ({ page }) => {
  await page.goto(url);
  // Newcomers see the live document before its source.
  await expect(page.locator('#mode-view')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#view-pane')).toBeVisible();
  await expect(page.locator('#view-pane .active-doc')).toBeVisible();
  await expect(page.locator('#source')).toBeHidden();
  // One click reaches the source, which is then saved in this browser.
  await page.locator('#mode-edit').click();
  await expect(page.locator('#source')).toBeVisible();
  await page.locator('#source').fill('# Mine\n\nHello');
  await page.reload();
  await expect(page.locator('#mode-edit')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#source')).toHaveValue('# Mine\n\nHello');
});
