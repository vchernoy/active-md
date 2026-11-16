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

test('quiz grouping diagnostics precede hidden pruning and navigate to the original source', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const question = ':::question{type=number}\nWhat is ten?\n\n:answer[10]\n:::';
  const invalid = ':::::when[0]\n' + question + '\n:::::\n\n::quiz-submit[Check]';
  await page.locator('#source').fill(invalid);
  const problem = page.locator('#problems button').filter({ hasText: 'question and its submit must share' });
  await expect(problem).toHaveText('Line 2:1 — quiz question and its submit must share the same enclosing when blocks');
  await problem.click();
  await expect(page.locator('#source')).toBeFocused();
  expect(await page.locator('#source').evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(':::::when[0]\n'.length);
  await page.locator('#source').fill(':::::when[0]\n' + question + '\n\n::quiz-submit[Check]\n:::::');
  await expect(page.locator('#problems-title')).toHaveText('No problems');
  await page.locator('#mode-view').click();
  await expect(page.locator('#doc input')).toHaveCount(0);
});
