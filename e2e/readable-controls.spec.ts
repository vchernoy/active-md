import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
let server: ViteDevServer, url: string;
test.beforeAll(async () => { server = await createPlaygroundServer(); await server.listen(); url = server.resolvedUrls!.local[0]!; });
test.afterAll(async () => { await server?.close(); });
test('readable controls preserve names, prose, keyboard, restore and independent mounts', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await page.goto(url);
  const paths = { remark: '/@fs' + new URL('../packages/remark/src/index.ts', import.meta.url).pathname,
    runtime: '/@fs' + new URL('../packages/runtime/src/index.ts', import.meta.url).pathname };
  const initial = await page.evaluate(async paths => {
    const { renderActive } = await import(paths.remark) as typeof import('../packages/remark/src/index.js');
    const { mount } = await import(paths.runtime) as typeof import('../packages/runtime/src/index.js');
    const source = '```calc\ninput x = 2 in 0..10\ny = x * 3\n```\n\nStart :edit[Investment]{input=x}, then :input[x].\n\n::slider[Amount]{input=x step=1}\n\n:value[y]';
    const roots = [0, 1].map(index => { const root = document.createElement('div'); root.id = 'readable-' + index; root.innerHTML = renderActive(source).html; document.body.append(root); return root; });
    let events = 0; roots[0]!.addEventListener('input', () => events++); roots[0]!.addEventListener('change', () => events++);
    const mounted = roots.map((root, index) => mount(root, { initialInputs: new Map([['x', index ? 4 : 7]]) }));
    (window as unknown as { readable: typeof mounted }).readable = mounted;
    return { events, values: mounted.map(live => live.session.inputValues().get('x')) };
  }, paths);
  expect(initial).toEqual({ events: 0, values: [7, 4] });
  const first = page.locator('#readable-0'), second = page.locator('#readable-1');
  await expect(first.getByRole('spinbutton', { name: 'Investment', exact: true })).toHaveValue('7');
  await expect(first.getByRole('spinbutton', { name: 'x', exact: true })).toHaveValue('7');
  const slider = first.getByRole('slider', { name: 'Amount', exact: true }); await slider.focus(); await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('8'); await expect(first.getByRole('spinbutton', { name: 'Investment', exact: true })).toHaveValue('8');
  await expect(second.getByRole('spinbutton', { name: 'Investment', exact: true })).toHaveValue('4');
  await expect(first.locator('p').first()).toHaveText('Start , then .');
  await expect(first.locator('.active-input-label')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { readable: { resetInputs(): void }[] }).readable[0]!.resetInputs());
  await expect(slider).toHaveValue('2'); await expect(first.getByRole('spinbutton', { name: 'Investment', exact: true })).toHaveValue('2');
  expect(await first.evaluate(root => root.scrollWidth <= innerWidth)).toBe(true);
});
