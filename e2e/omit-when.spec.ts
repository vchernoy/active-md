import { expect, test } from '@playwright/test';
import { renderActive } from '../packages/remark/src/index';

test('omitted subtrees stay absent while retained conditions reveal and update without requests', async ({ page }) => {
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
  const source = '```calc\nx = 10\ninput n = 0 in 0..10\n```\n\n:input[n]\n\n::::when[x > 5]\n:::when[n > 5]\n:value[n*2]\n\n$y={{n*2}}$\n:::\n\n:::when[n > 20]\nImpossible text\n:value[1/0]\n:::\n::::';
  const rendered = renderActive(source);
  expect(rendered.messages).toEqual([]);
  expect(rendered.html).not.toContain('Impossible text');
  expect(rendered.html).not.toContain('data-active-value="1/0"');
  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));
  await page.setContent(rendered.html);
  await page.addScriptTag({ content: code.code });
  await page.evaluate(() => {
    (window as unknown as { ActiveRuntime: { mount(root: HTMLElement): unknown } }).ActiveRuntime.mount(document.body);
  });
  const live = page.locator('[data-active-when="n > 5"]');
  await expect(live).toBeHidden();
  await page.locator('input').fill('10');
  await expect(live).toBeVisible();
  await expect(live.locator('output')).toHaveText('20');
  await expect(live.locator('math')).toContainText('20');
  await expect(page.locator('[data-active-when]')).toHaveCount(2);
  await expect(page.locator('.active-error, .katex-error')).toHaveCount(0);
  await page.locator('input').fill('0');
  await expect(live).toBeHidden();
  expect(requests).toEqual([]);
});
