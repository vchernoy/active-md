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

test('hidden question control diagnostics keep source positions and disappear after correction', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const prefix = ':::::when[0]\n';
  const invalid = prefix + ':::question{type=number}\nMissing answer\n:::\n\n::quiz-submit[Check]\n:::::';
  await page.locator('#source').fill(invalid);
  const problem = page.locator('#problems button').filter({ hasText: 'exactly one :answer' });
  await expect(problem).toHaveText('Line 2:1 — numeric quiz question must contain exactly one :answer control');
  await problem.click();
  await expect(page.locator('#source')).toBeFocused();
  expect(await page.locator('#source').evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(prefix.length);
  await page.locator('#source').fill(invalid.replace('Missing answer', 'Answer: :answer[10]'));
  await expect(page.locator('#problems-title')).toHaveText('No problems');
  await page.locator('#mode-view').click();
  await expect(page.locator('#doc input')).toHaveCount(0);
});

test('hidden quiz answer expression errors navigate to the answer and clear after correction', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const invalid = ':::::when[0]\n:::question{type=number}\nAnswer: :answer[missing]\n:::\n\n::quiz-submit[Check]\n:::::';
  await page.locator('#source').fill(invalid);
  const problem = page.locator('#problems button').filter({ hasText: 'quiz answer: unknown name' });
  await expect(problem).toHaveText('Line 3:9 — quiz answer: unknown name "missing"');
  await problem.click();
  await expect(page.locator('#source')).toBeFocused();
  expect(await page.locator('#source').evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(invalid.indexOf(':answer'));
  await page.locator('#source').fill(invalid.replace('missing', '10'));
  await expect(page.locator('#problems-title')).toHaveText('No problems');
});

test('hidden quiz seed binding diagnostics navigate to the submit and clear after a declared binding', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const invalid = ':::::when[0]\n:::question{type=number}\n:answer[10]\n:::\n\n::quiz-submit[Check]{seed=missing}\n:::::';
  await page.locator('#source').fill(invalid);
  const problem = page.locator('#problems button').filter({ hasText: 'quiz seed must name' });
  await expect(problem).toHaveText('Line 6:1 — quiz seed must name a declared calc input');
  await problem.click();
  await expect(page.locator('#source')).toBeFocused();
  expect(await page.locator('#source').evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(invalid.indexOf('::quiz-submit'));
  await page.locator('#source').fill('```calc\ninput seed = 1\n```\n\n' + invalid.replace('missing', 'seed'));
  await expect(page.locator('#problems-title')).toHaveText('No problems');
});

test('hidden single-choice acceptance diagnostics navigate to the question and clear after correction', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const invalid = ':::::when[0]\n:::question{type=single}\n::choice[Ten]{correct=false}\n:::\n\n::quiz-submit[Check]\n:::::';
  await page.locator('#source').fill(invalid);
  const problem = page.locator('#problems button').filter({ hasText: 'must mark at least one choice correct' });
  await expect(problem).toHaveText('Line 2:1 — choice quiz question must mark at least one choice correct');
  await problem.click();
  await expect(page.locator('#source')).toBeFocused();
  expect(await page.locator('#source').evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(':::::when[0]\n'.length);
  await page.locator('#source').fill(invalid.replace('correct=false', 'correct'));
  await expect(page.locator('#problems-title')).toHaveText('No problems');
});

test('hidden quiz tolerance diagnostics navigate to the answer and clear after correction', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const invalid = ':::::when[0]\n:::question{type=number}\nAnswer: :answer[10]{tolerance=-1}\n:::\n\n::quiz-submit[Check]\n:::::';
  await page.locator('#source').fill(invalid);
  const problem = page.locator('#problems button').filter({ hasText: 'quiz answer tolerance' });
  await expect(problem).toHaveText('Line 3:9 — quiz answer tolerance must be a finite nonnegative number');
  await problem.click();
  await expect(page.locator('#source')).toBeFocused();
  expect(await page.locator('#source').evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(invalid.indexOf(':answer'));
  await page.locator('#source').fill(invalid.replace('tolerance=-1', 'tolerance=0.01 relative'));
  await expect(page.locator('#problems-title')).toHaveText('No problems');
});

test('hidden question points diagnostics navigate to the declaration and clear after correction', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#source')).not.toHaveValue('');
  const invalid = ':::::when[0]\n:::question{type=number points=-1}\n:answer[10]\n:::\n\n::quiz-submit[Check]\n:::::';
  await page.locator('#source').fill(invalid);
  const problem = page.locator('#problems button').filter({ hasText: 'quiz question points must be a finite' });
  await expect(problem).toHaveText('Line 2:1 — quiz question points must be a finite nonnegative number');
  await problem.click();
  await expect(page.locator('#source')).toBeFocused();
  expect(await page.locator('#source').evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(':::::when[0]\n'.length);
  await page.locator('#source').fill(invalid.replace('points=-1', 'points=0.5'));
  await expect(page.locator('#problems-title')).toHaveText('No problems');
});
