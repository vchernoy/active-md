import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { renderActive } from '../packages/remark/src/index';

const css = readFileSync(new URL('../packages/runtime/style.css', import.meta.url), 'utf8');
const markdown = String.raw`$$
\begin{aligned}
P_n &= P_0(1+r/100)^n \\
    &= 10000(1+8/100)^{10} \\
    &\approx 21589.25
\end{aligned}
$$`;
test('three-row aligned MathML honors relation alignment with optional base styles', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.setContent(renderActive(markdown).html);
  await page.addStyleTag({ content: css });
  const signs = page.locator('mtable > mtr > mtd:nth-child(2) mo').filter({ hasText: /^(=|≈)$/ });
  await expect(signs).toHaveCount(3);
  const xs = await signs.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left));
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(2);
  expect(requests).toEqual([]);
});

test('controls are compact, theme-neutral, scoped, and do not style unmarked math tables', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.setContent(`<div class="active-doc"><label class="active-input"><input type="number" value="10" aria-invalid="true"></label><label class="active-input"><input type="range"></label><math><mtable><mtr><mtd style="padding:7px">x</mtd></mtr></mtable></math></div><input id="outside" type="number">`);
  const outside = await page.locator('#outside').evaluate(element => element.getBoundingClientRect().width);
  await page.addStyleTag({ content: css });
  expect(await page.locator('#outside').evaluate(element => element.getBoundingClientRect().width)).toBe(outside);
  expect(await page.locator('.active-doc input[type="number"]').evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(130);
  await expect(page.locator('mtd')).toHaveCSS('padding-left', '7px');
  await expect(page.locator('[aria-invalid]')).toHaveCSS('outline-style', 'solid');
});


test('matrix and cases spacing stays intact and aligned pairs stay separated', async ({ page }) => {
  await page.setContent(renderActive(String.raw`$$
\begin{pmatrix}1&2&3\\4&5&6\end{pmatrix}
$$

$$
\begin{cases}x & \text{if } x \ge 0\\-x & \text{otherwise}\end{cases}
$$

$$
\begin{aligned}a &= b & c &= d\\long &= e & f &= g\end{aligned}
$$`).html);
  const tables = page.locator('mtable[columnalign]');
  await expect(tables).toHaveCount(3);
  const snapshot = () => tables.evaluateAll(elements => elements.map(table =>
    Array.from(table.querySelectorAll(':scope > mtr > mtd')).map(cell => ({
      width: cell.getBoundingClientRect().width,
      left: getComputedStyle(cell).paddingLeft,
      right: getComputedStyle(cell).paddingRight,
    }))));
  const before = await snapshot();
  await page.addStyleTag({ content: css });
  const after = await snapshot();
  for (const index of [0, 1]) {
    after[index].forEach((cell, i) => {
      expect(cell.width).toBeGreaterThanOrEqual(before[index][i].width - 0.1);
      expect(cell.left).toBe(before[index][i].left);
      expect(cell.right).toBe(before[index][i].right);
    });
  }
  after[2].forEach((cell, i) => {
    if (i % 2 === 0) {
      expect(cell.left).toBe(before[2][i].left);
      expect(cell.right).toBe('0px');
    } else {
      expect(cell.left).toBe('0px');
      expect(cell.right).toBe(before[2][i].right);
    }
  });
});

test('pmatrix entries keep native positions with optional styles (#27)', async ({ page }) => {
  await page.setContent(renderActive(String.raw`$$\begin{pmatrix}1&222\\3333&4\end{pmatrix}$$`).html);
  const entries = page.locator('mtable > mtr > mtd mn');
  await expect(entries).toHaveCount(4);
  const positions = () => entries.evaluateAll(elements => elements.map(element => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })));
  const before = await positions();
  await page.addStyleTag({ content: css });
  const after = await positions();
  after.forEach((position, i) => {
    expect(Math.abs(position.x - before[i].x)).toBeLessThan(0.5);
    expect(Math.abs(position.y - before[i].y)).toBeLessThan(0.5);
  });
});

test('runtime sizes a bounded years control narrower than principal', async ({ page }) => {
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
  const html = renderActive('```calc\ninput years = 10 in 1..50\ninput principal = 10000 in 0..10000000\n```\n\nYears :input[years] Principal :input[principal]').html;
  expect(html).not.toContain('--active-input-ch');
  await page.setContent(html);
  await page.addScriptTag({ content: code.code });
  await page.evaluate(() => {
    (window as unknown as { ActiveRuntime: { mount(root: HTMLElement): unknown } }).ActiveRuntime.mount(document.body);
  });
  await page.addStyleTag({ content: css });
  const years = page.locator('input[data-active-input="years"]');
  const principal = page.locator('input[data-active-input="principal"]');
  expect(await years.evaluate(el => (el as HTMLElement).style.getPropertyValue('--active-input-ch'))).toBe('3');
  expect(await principal.evaluate(el => (el as HTMLElement).style.getPropertyValue('--active-input-ch'))).toBe('9');
  expect((await years.boundingBox())!.width).toBeLessThan((await principal.boundingBox())!.width);
});


test('optional math stack uses only local fonts and stays scoped without requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.setContent(renderActive('$x + 1$').html + '<math id="outside-math"><mi>x</mi></math>');
  const outside = await page.locator('#outside-math').evaluate(el => getComputedStyle(el).fontFamily);
  await page.addStyleTag({ content: css });
  const family = await page.locator('.active-doc math').evaluate(el => getComputedStyle(el).fontFamily);
  expect(family).toBe('"STIX Two Math", "Cambria Math", "Latin Modern Math", math');
  expect(await page.locator('#outside-math').evaluate(el => getComputedStyle(el).fontFamily)).toBe(outside);
  await page.evaluate(() => document.fonts.ready);
  expect(requests).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) test(`shared callouts are distinct, scoped and readable in ${theme}`, async ({ page }) => {
  await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
  const kinds = ['note', 'tip', 'warning', 'danger', 'important', 'exercise'];
  await page.setContent(renderActive(kinds.map(kind => `:::${kind}[Title]\nCallout body\n:::`).join('\n\n')).html + '<aside class="callout" id="outside-callout">Outside</aside>');
  await page.evaluate(theme => {
    document.documentElement.dataset.theme = theme;
    document.body.style.backgroundColor = theme === 'dark' ? '#0d1117' : '#ffffff';
    document.body.style.color = theme === 'dark' ? '#e6edf3' : '#1f2328';
  }, theme);
  const outside = await page.locator('#outside-callout').evaluate(el => getComputedStyle(el).borderLeftWidth);
  await page.addStyleTag({ content: css });
  const colors = [];
  for (const kind of kinds) {
    const callout = page.locator(`.active-doc .callout-${kind}`);
    await expect(callout).toHaveCount(1);
    colors.push(await callout.evaluate(el => getComputedStyle(el).borderLeftColor));
    const contrasts = await callout.evaluate(el => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d')!;
      const pixel = (color: string, base: string) => {
        ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = base; ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const luminance = (rgb: number[]) => rgb.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
      const base = getComputedStyle(document.body).backgroundColor;
      const bg = luminance(pixel(getComputedStyle(el).backgroundColor, base));
      return [el, el.querySelector('.callout-title')!].map(node => {
        const fg = luminance(pixel(getComputedStyle(node).color, base));
        return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      });
    });
    for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
  expect(new Set(colors).size).toBe(6);
  expect(await page.locator('#outside-callout').evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe(outside);
  await page.addStyleTag({ content: '.active-doc { --active-callout-note: #123456; }' });
  await expect(page.locator('.active-doc .callout-note')).toHaveCSS('border-left-color', 'rgb(18, 52, 86)');
  if (theme === 'dark') {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => delete document.documentElement.dataset.theme);
    await expect(page.locator('.active-doc .callout-note')).toHaveCSS('border-left-color', 'rgb(18, 52, 86)');
  }
});
