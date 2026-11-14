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
