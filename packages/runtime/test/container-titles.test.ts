// @vitest-environment jsdom
import { expect, it } from 'vitest';
import katex from 'katex';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

it('updates math in callout and details titles through the same runtime path as body math', async () => {
  const source = '```calc\ninput x = 2\n```\n\n:input[x]\n\n:::tip[Value ${{x}}$]\nBody ${{x}}$\n:::\n\n:::details[About ${{x}}$]\nBody\n:::';
  const root = document.createElement('div'); root.innerHTML = renderActive(source).html;
  const titleMath = () => [...root.querySelectorAll('.callout-title math, summary math')].map(m => m.outerHTML);
  expect(titleMath()).toHaveLength(2);
  const live = mount(root, { loadKatex: async () => katex });
  const input = root.querySelector('input')!;
  input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true }));
  await live.settled();
  const server = document.createElement('div'); server.innerHTML = renderActive(source.replace('input x = 2', 'input x = 5')).html;
  expect(titleMath()).toEqual([...server.querySelectorAll('.callout-title math, summary math')].map(m => m.outerHTML));
  expect(root.querySelector('.callout-title mn')?.textContent).toBe('5');
  expect(root.querySelector('summary mn')?.textContent).toBe('5');
  live.destroy();
});

it('keeps title math lazy inside a hidden conditional and refreshes when revealed', async () => {
  const source = '```calc\ninput x = 0 in 0..10\n```\n\n:input[x]\n\n::::when[x != 0]\n:::tip[Reciprocal ${{1/x}}$]\nBody\n:::\n::::';
  const result = renderActive(source); expect(result.messages).toEqual([]);
  const root = document.createElement('div'); root.innerHTML = result.html;
  expect(root.querySelector('.callout-title math')).toBeNull();
  const live = mount(root, { loadKatex: async () => katex });
  const input = root.querySelector('input')!;
  input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true }));
  await live.settled();
  expect(root.querySelector('.callout-title mn')?.textContent).toBe('0.5');
  expect(root.querySelector('.active-error, .katex-error')).toBeNull();
  live.destroy();
});
