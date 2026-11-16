import { expect, test } from '@playwright/test';
import { renderActive } from '../packages/remark/src/index';
import { SAMPLE } from '../apps/playground/src/sample';

test('invalid years has a visible associated explanation that clears on correction', async ({ page }) => {
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
  const years = page.locator('input[data-active-input="years"]');
  const message = page.locator('#' + await years.getAttribute('aria-describedby'));
  await years.fill('0');
  await expect(years).toHaveAttribute('aria-invalid', 'true');
  await expect(message).toBeVisible();
  await expect(years).toHaveAccessibleName('Term (years)');
  await expect(message).toHaveText('enter a number from 1 to 50. Results use the last accepted value.');
  await expect(message).toHaveAttribute('aria-live', 'polite');
  await years.fill('11');
  await expect(years).not.toHaveAttribute('aria-invalid', 'true');
  await expect(message).toBeEmpty();
});
