import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { renderActive } from '../packages/remark/src/index';
const css = readFileSync(new URL('../packages/runtime/style.css', import.meta.url), 'utf8');
const colors = ['red', 'green', 'blue', 'orange', 'purple', 'gray'];
const luminance = (rgb: number[]) => rgb.map(value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
for (const [root, system, dark] of [['', 'light', false], ['', 'dark', true], ['light', 'dark', false], ['dark', 'light', true]] as const) {
  test(`named prose palette is scoped and readable: root=${root || 'system'} system=${system}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: system });
    const requests: string[] = []; page.on('request', request => requests.push(request.url()));
    const rendered = renderActive(colors.map(color => `:mark[${color}]{color=${color}}`).join(' '));
    await page.setContent(rendered.html + '<span id="outside" class="active-mark-red">Outside</span>');
    await page.evaluate(root => { if (root) document.documentElement.dataset.theme = root; }, root);
    const outside = await page.locator('#outside').evaluate(el => getComputedStyle(el).color);
    await page.addStyleTag({ content: css });
    expect(await page.locator('#outside').evaluate(el => getComputedStyle(el).color)).toBe(outside);
    const foregrounds = await page.locator('.active-doc .active-mark').evaluateAll(elements => elements.map(el => getComputedStyle(el).color));
    expect(foregrounds).toHaveLength(6);
    const background = luminance(dark ? [13, 17, 23] : [255, 255, 255]);
    for (const foreground of foregrounds) {
      const value = luminance(foreground.match(/\d+/g)!.map(Number));
      expect((Math.max(value, background) + 0.05) / (Math.min(value, background) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
    expect(requests).toEqual([]);
  });
}
