import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
let server: ViteDevServer, url: string;
test.beforeAll(async () => { server = await createPlaygroundServer(); await server.listen(); url = server.resolvedUrls!.local[0]!; });
test.afterAll(async () => { await server?.close(); });
test('native select supports keyboard, numeric peers, reset, restore, independent mounts and narrow labels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 }); await page.goto(url);
  const paths = { remark: '/@fs' + new URL('../packages/remark/src/index.ts', import.meta.url).pathname,
    runtime: '/@fs' + new URL('../packages/runtime/src/index.ts', import.meta.url).pathname };
  const initial = await page.evaluate(async paths => {
    const { renderActive } = await import(paths.remark) as typeof import('../packages/remark/src/index.js');
    const { mount } = await import(paths.runtime) as typeof import('../packages/runtime/src/index.js');
    const source = '```calc\ninput delivery = 10 in -1..30\ntotal = 100 + delivery\n```\n\n:::select[Delivery]{input=delivery}\n::option[Pickup]{value=0}\n::option[Standard]{value=10}\n::option[Express — Доставка 🚚 very long description of the shipping option]{value=25}\n:::\n\n:edit{input=delivery}\n\n:value[total]\n\n:::when[delivery == 25]\nExpress selected\n:::';
    const roots = [0, 1].map(index => { const root = document.createElement('div'); root.id = 'select-' + index; root.innerHTML = renderActive(source).html; return root; });
    document.body.replaceChildren(...roots);
    let events = 0; roots[0]!.addEventListener('input', () => events++); roots[0]!.addEventListener('change', () => events++);
    const lives = roots.map((root, index) => mount(root, { initialInputs: new Map([['delivery', index ? 11 : 0]]) }));
    (window as unknown as { selectLives: typeof lives }).selectLives = lives;
    return { events, values: lives.map(live => live.session.inputValues().get('delivery')) };
  }, paths);
  expect(initial).toEqual({ events: 0, values: [0, 10] });
  const first = page.locator('#select-0'), second = page.locator('#select-1');
  const select = first.getByRole('combobox', { name: 'Delivery' });
  await select.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
  await expect(select).toHaveValue('10'); await expect(first.getByRole('spinbutton')).toHaveValue('10');
  await select.selectOption('25'); await expect(first.locator('output')).toHaveText('125');
  await expect(first.getByText('Express selected', { exact: true })).toBeVisible();
  await expect(second.getByRole('combobox')).toHaveValue('10');
  await first.getByRole('spinbutton').fill('11'); await expect(first.getByRole('spinbutton')).toHaveAttribute('aria-invalid', 'true');
  await expect(select).toHaveValue('25'); await expect(first.locator('output')).toHaveText('125');
  await page.evaluate(() => (window as unknown as { selectLives: { resetInputs(): void }[] }).selectLives[0]!.resetInputs());
  await expect(select).toHaveValue('10'); await expect(first.getByRole('spinbutton')).toHaveValue('10');
  await expect(first.getByText('Express selected', { exact: true })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
