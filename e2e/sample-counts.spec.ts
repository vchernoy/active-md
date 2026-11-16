import { expect, test } from '@playwright/test';
import { renderActive } from '../packages/remark/src/index';
import { SAMPLE } from '../apps/playground/src/sample';

test('default sample uses whole-count keyboard increments and keeps the fractional rate step', async ({ page }) => {
  const { build } = await import('vite');
  const bundle = await build({ configFile: false, build: { write: false,
    lib: { entry: new URL('../packages/runtime/src/index.ts', import.meta.url).pathname, name: 'ActiveRuntime', formats: ['iife'] },
    rollupOptions: { output: { inlineDynamicImports: true } },
  } });
  const outputs = Array.isArray(bundle) ? bundle : [bundle];
  const code = outputs.flatMap(output => 'output' in output ? output.output : []).find(output => output.type === 'chunk');
  if (!code || code.type !== 'chunk') throw new Error('No runtime browser bundle');
  const rendered = renderActive(SAMPLE, { locale: 'en-US' });
  expect(rendered.messages).toEqual([]);
  await page.setContent(rendered.html); await page.addScriptTag({ content: code.code });
  await page.evaluate(() => (window as unknown as { ActiveRuntime: { mount(root: HTMLElement, options: { locale: string }): unknown } }).ActiveRuntime.mount(document.body, { locale: 'en-US' }));
  const people = page.locator('input[data-active-input="people"]');
  await expect(people).toHaveValue('4');
  await people.focus(); await people.press('ArrowRight');
  await expect(people).toHaveValue('5');
  await expect(page.locator('output[data-active-value="rooms"]')).toHaveText('3');
  await expect(page.locator('output[data-active-value="share"]')).toHaveText('9,360');
  const nights = page.locator('input[data-active-input="nights"]');
  await nights.focus(); await nights.press('ArrowUp'); await expect(nights).toHaveValue('4');
  await expect(page.locator('output[data-active-value="share"]')).toHaveText('12,480');
  const years = page.locator('input[data-active-input="years"]');
  await years.focus(); await years.press('ArrowUp'); await expect(years).toHaveValue('11');
  const rate = page.locator('input[data-active-input="rate"]');
  await rate.focus(); await rate.press('ArrowRight'); await expect(rate).toHaveValue('8.5');
});
