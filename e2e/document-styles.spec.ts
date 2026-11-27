import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ViteDevServer } from 'vite';
import { renderActive } from '../packages/remark/src/index';
import { createPlaygroundServer } from './playground-server';

// Optional document styles (styles.css): data-active-style on an ancestor, CSS only, native controls.
const base = readFileSync(new URL('../packages/runtime/style.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../packages/runtime/styles.css', import.meta.url), 'utf8');
const markdown = [
  '```calc', 'input n = 2 in 0..9', '```', '', '::slider[Amount]{input=n step=1}', '',
  ':::radio[Size]{input=n}', '::option[Small]{value=1}', '::option[Large]{value=2}', ':::', '',
  ':::question{type=single}', 'Pick', '', '::choice[A]{correct}', '::choice[B]', ':::', '',
  ':::question{type=multiple}', 'Pick', '', '::choice[C]{correct}', '::choice[D]', ':::', '',
  '::quiz-submit[Check]',
].join('\n');
const STYLES = ['sketch', 'brutal', 'notebook', 'chalkboard'];

async function load(page: Page, wrapper: string): Promise<void> {
  await page.setContent(`${wrapper.replace('%', renderActive(markdown, { quizManifest: true }).html)}`);
  await page.addStyleTag({ content: base });
  await page.addStyleTag({ content: styles });
}
const setStyle = (page: Page, value: string | null) => page.locator('#wrap').evaluate((el, v) => {
  if (v === null) el.removeAttribute('data-active-style'); else el.setAttribute('data-active-style', v);
}, value);

test('each style applies only under data-active-style and keeps controls native', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await load(page, '<div id="wrap">%</div>');
  const radio = page.locator('input[type="radio"][data-active-choice]').first();
  const checkbox = page.locator('input[type="checkbox"]').first();
  await expect(radio).not.toHaveCSS('appearance', 'none');
  for (const style of STYLES) {
    await setStyle(page, style);
    await expect(radio).toHaveCSS('appearance', 'none');
    await expect(checkbox).toHaveCSS('appearance', 'none');
    await expect(page.locator('.active-question').first()).not.toHaveCSS('border-top-width', '1px');
  }
  // Still real form controls: clicking and the keyboard toggle them.
  await radio.click();
  await expect(radio).toBeChecked();
  // Tab from the last radio to the checkbox: keyboard focus shows the drawn :focus-visible ring.
  await page.locator('input[type="radio"]').last().focus();
  await page.keyboard.press('Tab');
  await expect(checkbox).toBeFocused();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toHaveCSS('outline-style', 'dashed');
  for (const value of ['plain', 'unknown-style', null]) {
    await setStyle(page, value);
    await expect(radio).not.toHaveCSS('appearance', 'none');
  }
  expect(requests).toEqual([]);
});

test('the 0.12 class active-sketch still selects the hand-drawn style', async ({ page }) => {
  await load(page, '<div class="active-sketch">%</div>');
  await expect(page.locator('input[type="radio"]').first()).toHaveCSS('appearance', 'none');
  await expect(page.locator('.active-quiz-check')).toHaveCSS('transform', /matrix/);
});

test('forced colors fall back to native radios and checkboxes so checked states stay visible', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await load(page, '<div id="wrap">%</div>');
  for (const style of STYLES) {
    await setStyle(page, style);
    for (const kind of ['radio', 'checkbox']) {
      const input = page.locator(`input[type="${kind}"]`).first();
      await expect(input).not.toHaveCSS('appearance', 'none');
      expect(await input.evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
    }
  }
});

test('drawn lines follow the document text color, also on a button with its own text color', async ({ page }) => {
  // A light-on-dark host that sets no color-scheme.
  await load(page, '<div id="wrap" style="color: rgb(240, 240, 240); background: rgb(20, 20, 20)">%</div>');
  for (const style of ['sketch', 'brutal']) {
    await setStyle(page, style);
    for (const kind of ['radio', 'checkbox']) {
      await expect(page.locator(`input[type="${kind}"]`).first()).toHaveCSS('border-top-color', 'rgb(240, 240, 240)');
    }
    // Brutal paints dark text on its yellow button; the outline must still be the document ink.
    await expect(page.locator('.active-quiz-check')).toHaveCSS('border-top-color', 'rgb(240, 240, 240)');
  }
  await expect(page.locator('.active-quiz-check')).toHaveCSS('-webkit-text-fill-color', 'rgb(17, 17, 17)');
});

test('notebook paper and the chalkboard keep host-coloured labels readable', async ({ page }) => {
  // The host colours labels grey for its own background, which the paper and the board replace.
  await load(page, '<style>.active-input-label { color: rgb(150, 150, 150); }</style><div id="wrap">%</div>');
  for (const [style, text] of [['notebook', 'rgb(34, 48, 77)'], ['chalkboard', 'rgb(238, 242, 234)']] as const) {
    await setStyle(page, style);
    await expect(page.locator('.active-doc')).toHaveCSS('color', text);
    await expect(page.locator('.active-input-label').first()).toHaveCSS('color', text);
  }
});

test('notebook and chalkboard keep inline code and code blocks readable over host code colours', async ({ page }) => {
  // The host gives code a near-white panel (light theme) or a dark panel (dark theme).
  for (const panel of ['rgb(246, 248, 250)', 'rgb(21, 27, 35)']) {
    await page.setContent(`<style>.active-doc code, .active-doc pre { background: ${panel}; color: inherit; }</style><div id="wrap">${renderActive('Use `x` here.\n\n```\nblock\n```').html}</div>`);
    await page.addStyleTag({ content: base });
    await page.addStyleTag({ content: styles });
    for (const [style, bg, fg] of [['notebook', 'rgb(239, 233, 214)', 'rgb(34, 48, 77)'], ['chalkboard', 'rgba(255, 255, 255, 0.1)', 'rgb(246, 248, 242)']] as const) {
      await setStyle(page, style);
      await expect(page.locator('p code')).toHaveCSS('background-color', bg);
      await expect(page.locator('p code')).toHaveCSS('color', fg);
      await expect(page.locator('pre')).toHaveCSS('background-color', bg);
      await expect(page.locator('pre code')).toHaveCSS('color', fg);
    }
  }
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

  test('Style lists every document style, applies the choice and remembers it after reload', async ({ page }) => {
    await page.goto(url);
    const select = page.getByRole('combobox', { name: 'Style' });
    const doc = page.locator('#doc');
    await expect(select.locator('option')).toHaveText(['Plain', 'Hand-drawn', 'Bold (neo-brutalism)', 'Notebook', 'Chalkboard']);
    await expect(select).toHaveValue('plain');
    await expect(doc).not.toHaveAttribute('data-active-style');
    await select.selectOption('brutal');
    await expect(doc).toHaveAttribute('data-active-style', 'brutal');
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Style' })).toHaveValue('brutal');
    await expect(doc).toHaveAttribute('data-active-style', 'brutal');
    await page.getByRole('combobox', { name: 'Style' }).selectOption('plain');
    await expect(doc).not.toHaveAttribute('data-active-style');
  });

  test('a 0.12 Hand-drawn choice becomes the sketch style', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('active-md.playground.sketch.v1', 'on');
        sessionStorage.setItem('seeded', '1');
      }
    });
    await page.goto(url);
    await expect(page.getByRole('combobox', { name: 'Style' })).toHaveValue('sketch');
    await expect(page.locator('#doc')).toHaveAttribute('data-active-style', 'sketch');
  });
});
