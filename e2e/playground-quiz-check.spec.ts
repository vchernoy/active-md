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

// #48: a reader answers, checks and retries a quiz group in the rendered page.
const quiz = '```calc\ninput a = 3\n```\n\nIf a = :value[a], what is 4a?\n\n:::question{type=number}\nYour answer for 4a:\n\n:answer[4 * a]\n:::\n\n' +
  ':::question{type=single points=2}\nWhich is larger?\n\n::choice[$2^{10}$]{correct}\n::choice[$10^3$]\n:::\n\n::quiz-submit[Check]\n';

test('a reader checks a quiz, sees the score and per-question feedback, then retries', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  await page.locator('#mode-edit').click();
  await page.locator('#source').fill(quiz);
  await expect(page.locator('#problems-title')).toHaveText('No problems');
  await page.locator('#mode-view').click();
  const doc = page.locator('#doc');
  // The answer is not in the page before checking.
  expect(await doc.innerHTML()).not.toContain('4 * a');
  await doc.getByRole('textbox', { name: 'Your answer' }).fill('11');
  await doc.getByRole('group', { name: 'Question 2' }).getByRole('radio').first().check();
  await doc.getByRole('button', { name: 'Check' }).click();
  await expect(doc.getByRole('status').filter({ hasText: 'Score' })).toHaveText('Score: 2 of 3');
  await expect(doc.getByRole('group', { name: 'Question 1' })).toContainText('Not correct (0 of 1)');
  await expect(doc.getByRole('group', { name: 'Question 2' })).toContainText('Correct (2 of 2)');
  await expect(doc.getByRole('textbox', { name: 'Your answer' })).toBeDisabled();
  await doc.getByRole('button', { name: 'Retry' }).click();
  await expect(doc.getByRole('textbox', { name: 'Your answer' })).toBeEnabled();
  await expect(doc.getByRole('textbox', { name: 'Your answer' })).toBeFocused();
  await doc.getByRole('textbox', { name: 'Your answer' }).fill('12');
  await doc.getByRole('group', { name: 'Question 2' }).getByRole('radio').first().check();
  await doc.getByRole('button', { name: 'Check' }).click();
  await expect(doc.getByRole('status').filter({ hasText: 'Score' })).toHaveText('Score: 3 of 3');
});
