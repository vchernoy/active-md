// @vitest-environment jsdom
import { expect, it } from 'vitest';
import katex from 'katex';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

it('server and runtime agree as power bases switch positive, negative, then positive', async () => {
  const source = '```calc\ninput x = 3\n```\n\n:input[x]\n\n${{x}}^2 + 2 \\cdot {{x | fixed:1}}$';
  const root = document.createElement('div'); root.innerHTML = renderActive(source).html;
  const initial = root.querySelector('math')!.outerHTML;
  const live = mount(root, { loadKatex: async () => katex });
  const input = root.querySelector('input')!;
  input.value = '-3'; input.dispatchEvent(new Event('input', { bubbles: true })); await live.settled();
  const server = document.createElement('div'); server.innerHTML = renderActive(source.replace('input x = 3', 'input x = -3')).html;
  expect(root.querySelector('math')!.outerHTML).toBe(server.querySelector('math')!.outerHTML);
  expect(root.querySelector('math')!.textContent).toContain('(');
  input.value = '3'; input.dispatchEvent(new Event('input', { bubbles: true })); await live.settled();
  expect(root.querySelector('math')!.outerHTML).toBe(initial);
  live.destroy();
});

it('keeps boxed text labels valid and in server/runtime agreement after live negative updates', async () => {
  const source = '```calc\ninput x = 3\n```\n\n:input[x]\n\n$\\fbox{Cost - {{x}}} + \\colorbox{red}{Cost - {{x}}} + \\fcolorbox{red}{blue}{Cost - {{x}}} + \\emph{Cost - {{x}}} + {{x}}^2$';
  const root = document.createElement('div'); root.innerHTML = renderActive(source).html;
  const live = mount(root, { loadKatex: async () => katex });
  const input = root.querySelector('input')!;
  input.value = '-3'; input.dispatchEvent(new Event('input', { bubbles: true })); await live.settled();
  const server = document.createElement('div'); server.innerHTML = renderActive(source.replace('input x = 3', 'input x = -3')).html;
  expect(root.querySelector('.katex-error')).toBeNull();
  expect(root.querySelector('math')!.outerHTML).toBe(server.querySelector('math')!.outerHTML);
  expect(root.querySelector('math')!.textContent).toContain('Cost');
  live.destroy();
});
