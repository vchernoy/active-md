import { expect, test } from '@playwright/test';
import { renderActive } from '../packages/remark/src/index';

test('initial inputs and reset agree across model, controls, formulas and visibility', async ({ page }) => {
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
  const source = '```calc\ninput x = 2 in 0..10\ninput seed = 3 in 0..20\ny = x + seed\n```\n\n:input[x] :input[x]{widget=slider step=1}\n\n:value[y]\n\n$y={{y}}$\n\n:::when[x > 4]\nRestored\n:::';
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.setContent('<div id="stage" hidden>' + renderActive(source).html + '</div>');
  await page.addScriptTag({ content: code.code });
  const result = await page.evaluate(async () => {
    type Live = { session: { inputValues(): Map<string, number> }; settled(): Promise<void>; resetInputs(): void };
    const win = window as unknown as { ActiveRuntime: { mount(root: HTMLElement, options: { initialInputs: Map<string, number> }): Live }; live: Live };
    const stage = document.querySelector<HTMLElement>('#stage')!;
    win.live = win.ActiveRuntime.mount(stage, { initialInputs: new Map([['x', 5], ['seed', 7], ['unknown', 9]]) });
    await win.live.settled(); stage.hidden = false;
    return [...win.live.session.inputValues()];
  });
  expect(result).toEqual([['x', 5], ['seed', 7]]);
  await expect(page.locator('input[type=number]')).toHaveValue('5');
  await expect(page.locator('input[type=range]')).toHaveValue('5');
  await expect(page.locator('output[data-active-value="y"]')).toHaveText('12');
  await expect(page.locator('math mn')).toHaveText('12');
  await expect(page.locator('[data-active-when]')).toBeVisible();
  await page.evaluate(async () => {
    const live = (window as unknown as { live: { resetInputs(): void; settled(): Promise<void> } }).live;
    live.resetInputs(); await live.settled();
  });
  await expect(page.locator('input[type=number]')).toHaveValue('2');
  await expect(page.locator('input[type=range]')).toHaveValue('2');
  await expect(page.locator('output[data-active-value="y"]')).toHaveText('5');
  await expect(page.locator('math mn')).toHaveText('5');
  await expect(page.locator('[data-active-when]')).toBeHidden();
  expect(requests).toEqual([]);
});
