import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ViteDevServer } from 'vite';
import { renderActive } from '../packages/remark/src/index';
import { createPlaygroundServer } from './playground-server';

// Optional hand-drawn look (sketch.css): opt-in by an ancestor class, CSS only, controls stay native.
const base = readFileSync(new URL('../packages/runtime/style.css', import.meta.url), 'utf8');
const sketch = readFileSync(new URL('../packages/runtime/sketch.css', import.meta.url), 'utf8');
const markdown = [
  '```calc', 'input n = 2 in 0..9', '```', '', ':slider[n]{input=n step=1}', '',
  ':::question{type=single}', 'Pick', '', '::choice[A]{correct}', '::choice[B]', ':::', '',
  ':::question{type=multiple}', 'Pick', '', '::choice[C]{correct}', '::choice[D]', ':::', '',
  '::quiz-submit[Check]',
].join('\n');

test('the sketch look applies only under .active-sketch and keeps controls native', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.setContent(`<div id="wrap">${renderActive(markdown, { quizManifest: true }).html}</div>`);
  await page.addStyleTag({ content: base });
  await page.addStyleTag({ content: sketch });
  const radio = page.locator('input[type="radio"]').first();
  const checkbox = page.locator('input[type="checkbox"]').first();
  await expect(radio).not.toHaveCSS('appearance', 'none');
  await page.locator('#wrap').evaluate(el => el.classList.add('active-sketch'));
  await expect(radio).toHaveCSS('appearance', 'none');
  await expect(checkbox).toHaveCSS('appearance', 'none');
  await expect(page.locator('.active-question').first()).toHaveCSS('border-top-width', '2px');
  // Still real form controls: clicking and the keyboard toggle them.
  await radio.click();
  await expect(radio).toBeChecked();
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toHaveCSS('outline-style', 'dashed');
  await page.locator('#wrap').evaluate(el => el.classList.remove('active-sketch'));
  await expect(radio).not.toHaveCSS('appearance', 'none');
  expect(requests).toEqual([]);
});

test.describe('playground', () => {
  let server: ViteDevServer;
  let url: string;
  test.beforeAll(async () => {
    server = await createPlaygroundServer();
    await server.listen();
    url = server.resolvedUrls!.local[0]!;
  });
  test.afterAll(async () => { await server?.close(); });

  test('Hand-drawn toggles the look and is remembered after reload', async ({ page }) => {
    await page.goto(url);
    const button = page.getByRole('button', { name: 'Hand-drawn' });
    const doc = page.locator('#doc');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(doc).not.toHaveClass(/active-sketch/);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(doc).toHaveClass(/active-sketch/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Hand-drawn' })).toHaveAttribute('aria-pressed', 'true');
    await expect(doc).toHaveClass(/active-sketch/);
    await page.getByRole('button', { name: 'Hand-drawn' }).click();
    await expect(doc).not.toHaveClass(/active-sketch/);
  });
});
