import { expect, test } from '@playwright/test';
import { renderActive } from '../packages/remark/src/index';

test('callout and details titles typeset inline math and update live without network requests', async ({ page }) => {
  const { build } = await import('vite');
  const bundle = await build({
    configFile: false,
    build: {
      write: false,
      lib: { entry: new URL('../packages/runtime/src/index.ts', import.meta.url).pathname, name: 'ActiveRuntime', formats: ['iife'] },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const outputs = Array.isArray(bundle) ? bundle : [bundle];
  const code = outputs.flatMap(output => 'output' in output ? output.output : []).find(output => output.type === 'chunk');
  if (!code || code.type !== 'chunk') throw new Error('No runtime browser bundle');
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  const source = '```calc\ninput x = 2\n```\n\n:input[x]\n\n:::tip[**Why** is $x^0 = 1$? Value ${{x}}$]\nBody\n:::\n\n:::details[About $0^0$ and ${{x}}$]\nBody\n:::';
  const rendered = renderActive(source); expect(rendered.messages).toEqual([]);
  await page.setContent(rendered.html);
  await expect(page.locator('.callout-title math')).toHaveCount(2);
  await expect(page.locator('summary math')).toHaveCount(2);
  await expect(page.locator('.callout-title strong')).toHaveText('Why');
  await page.addScriptTag({ content: code.code });
  await page.evaluate(() => {
    (window as unknown as { ActiveRuntime: { mount(root: HTMLElement): unknown } }).ActiveRuntime.mount(document.body);
  });
  await page.locator('input').fill('5');
  await expect(page.locator('.callout-title math').last().locator('mn')).toHaveText('5');
  await expect(page.locator('summary math').last().locator('mn')).toHaveText('5');
  await expect(page.locator('.active-error, .katex-error')).toHaveCount(0);
  expect(requests).toEqual([]);
});
