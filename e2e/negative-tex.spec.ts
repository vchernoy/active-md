import { expect, test } from '@playwright/test';
import { renderActive } from '../packages/remark/src/index';

test('negative live power bases and factors gain parentheses and return to the positive rendering', async ({ page }) => {
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
  const source = '```calc\ninput x = 3\n```\n\n:input[x]\n\n${{x}}^2 + 2 \\cdot {{x | fixed:1}}$';
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.setContent(renderActive(source).html);
  const original = await page.locator('math').evaluate(el => el.outerHTML);
  const parentheses = page.locator('math mo').filter({ hasText: /^[()]$/ });
  await expect(parentheses).toHaveCount(0);
  await page.addScriptTag({ content: code.code });
  await page.evaluate(() => {
    (window as unknown as { ActiveRuntime: { mount(root: HTMLElement): unknown } }).ActiveRuntime.mount(document.body);
  });
  await page.locator('input').fill('-3'); await expect(parentheses).toHaveCount(4);
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.locator('input').fill('3'); await expect(parentheses).toHaveCount(0);
  expect(await page.locator('math').evaluate(el => el.outerHTML)).toBe(original);
  expect(requests).toEqual([]);
});

test('boxed labels remain valid during negative live updates', async ({ page }) => {
  const { build } = await import('vite');
  const bundle = await build({ configFile: false, build: { write: false,
    lib: { entry: new URL('../packages/runtime/src/index.ts', import.meta.url).pathname, name: 'ActiveRuntime', formats: ['iife'] },
    rollupOptions: { output: { inlineDynamicImports: true } },
  } });
  const outputs = Array.isArray(bundle) ? bundle : [bundle];
  const code = outputs.flatMap(output => 'output' in output ? output.output : []).find(output => output.type === 'chunk');
  if (!code || code.type !== 'chunk') throw new Error('No runtime browser bundle');
  const source = '```calc\ninput x = 3\n```\n\n:input[x]\n\n$\\fbox{Cost - {{x}}} + \\colorbox{red}{Cost - {{x}}} + \\fcolorbox{red}{blue}{Cost - {{x}}} + \\emph{Cost - {{x}}} + \\underbar{Cost - {{x}}} + \\llap{Cost - {{x}}} + \\rlap{Cost - {{x}}} + \\clap{Cost - {{x}}} + {{x}}^2$';
  await page.setContent(renderActive(source).html); await page.addScriptTag({ content: code.code });
  await page.evaluate(() => (window as unknown as { ActiveRuntime: { mount(root: HTMLElement): unknown } }).ActiveRuntime.mount(document.body));
  await page.locator('input').fill('-3');
  await expect(page.locator('math mo').filter({ hasText: /^[()]$/ })).toHaveCount(2);
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await expect(page.locator('math')).toContainText('Cost');
  const server = renderActive(source.replace('input x = 3', 'input x = -3')).html;
  const expected = await page.evaluate(html => {
    const root = document.createElement('div'); root.innerHTML = html; return root.querySelector('.active-math')!.innerHTML;
  }, server);
  expect(await page.locator('.active-math').innerHTML()).toBe(expected);
});
