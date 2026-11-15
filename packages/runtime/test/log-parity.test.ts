// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

it('renderer and runtime agree on log values before and after input changes', async () => {
  const source = '```calc\ninput rate = 8\ndoubling = log(2) / log(1 + rate/100)\n```\n\n:input[rate] :value[doubling]{format=fixed:6}';
  const root = document.createElement('div');
  const initial = renderActive(source);
  expect(initial.messages).toEqual([]);
  root.innerHTML = initial.html;
  const before = root.querySelector('output')!.textContent;
  const live = mount(root);
  expect(root.querySelector('output')!.textContent).toBe(before);
  root.querySelector('input')!.value = '30';
  root.querySelector('input')!.dispatchEvent(new Event('input', { bubbles: true }));
  await live.settled();
  const server = document.createElement('div');
  server.innerHTML = renderActive(source.replace('input rate = 8', 'input rate = 30')).html;
  expect(root.querySelector('output')!.textContent).toBe(server.querySelector('output')!.textContent);
  expect(root.querySelector('output')!.textContent).not.toBe(before);
  live.destroy();
});
