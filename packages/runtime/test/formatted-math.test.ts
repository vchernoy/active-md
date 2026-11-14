// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import katex from 'katex';
import { mount } from '../src/index.js';

for (const locale of ['en-US', 'ru-RU']) {
  describe(`formatted math updates (${locale})`, () => {
    it('uses the same server/runtime path, matches value formatting, and leaves literals unchanged', async () => {
      const source = '```calc\ninput x = 43178.5\n```\n\n:input[x] :value[x]{format=fixed:2}\n\n$ {{x | fixed:2}} $\n\n$ 43178.5 $';
      const root = document.createElement('div');
      root.innerHTML = renderActive(source, { locale }).html;
      const literal = root.querySelectorAll('math')[1]!.outerHTML;
      const live = mount(root, { locale, loadKatex: async () => katex });
      const input = root.querySelector('input')!;
      input.value = '87654.3';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await live.settled();
      const server = document.createElement('div');
      server.innerHTML = renderActive(source.replace('input x = 43178.5', 'input x = 87654.3'), { locale }).html;
      expect(root.querySelector('math')!.outerHTML).toBe(server.querySelector('math')!.outerHTML);
      expect(root.querySelector('output')!.textContent).toBe(new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(87654.3));
      expect(root.querySelectorAll('math')[1]!.outerHTML).toBe(literal);
      live.destroy();
    });
    it('keeps invalid format as a red error on updates', async () => {
      const root = document.createElement('div');
      root.innerHTML = renderActive('```calc\ninput x = 1\n```\n\n:input[x]\n\n$ {{x | bogus}} $', { locale }).html;
      const live = mount(root, { locale, loadKatex: async () => katex });
      const input = root.querySelector('input')!;
      input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true }));
      await live.settled();
      expect(root.querySelector('math')!.innerHTML).toContain('mathcolor="red"');
      live.destroy();
    });
  });
}
