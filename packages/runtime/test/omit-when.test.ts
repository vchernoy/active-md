// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

it('retains a true outer block with live nested values while omitting only impossible content', async () => {
  const source = '```calc\nx = 10\ninput n = 0 in 0..10\n```\n\n:input[n]\n\n::::when[x > 5]\n:value[n+1]\n\n:::when[n > 5]\n:value[n*2]\n\n$y={{n*2}}$\n:::\n\n:::when[n > 20]\nImpossible content\n:value[1/0]\n:::\n::::';
  const initial = renderActive(source);
  expect(initial.messages).toEqual([]);
  document.body.innerHTML = initial.html;
  expect(document.body.textContent).not.toContain('Impossible content');
  expect(document.querySelector('[data-active-value="1/0"]')).toBeNull();
  const gates = [...document.querySelectorAll<HTMLElement>('[data-active-when]')];
  expect(gates.map(g => g.hidden)).toEqual([false, true]);
  const m = mount(document.body);
  expect(gates.map(g => g.hidden)).toEqual([false, true]);
  const input = document.querySelector('input')!;
  input.value = '10';
  input.dispatchEvent(new Event('input'));
  await m.settled();
  expect(gates.map(g => g.hidden)).toEqual([false, false]);
  expect([...document.querySelectorAll('output')].map(o => o.textContent)).toEqual(['11', '20']);
  const rendered = document.createElement('div');
  rendered.innerHTML = renderActive(source.replace('input n = 0', 'input n = 10')).html;
  expect(document.querySelector('math')!.outerHTML).toBe(rendered.querySelector('math')!.outerHTML);
  expect(document.querySelector('.active-error, .katex-error')).toBeNull();
  input.value = '0';
  input.dispatchEvent(new Event('input'));
  await m.settled();
  expect(gates.map(g => g.hidden)).toEqual([false, true]);
  m.destroy();
});

it('emits no subtree-only runtime work for a proven-false block', async () => {
  const r = renderActive('```calc\ninput n = 0 in 0..10\n```\n\n:input[n]\n\n::::when[0 and n]\n:value[1/0]\n\n$bad={{log(-1)}}$\n\n:::when[unknown]\nDead\n:::\n::::');
  expect(r.messages).toEqual([]);
  document.body.innerHTML = r.html;
  const loadKatex = vi.fn();
  const m = mount(document.body, { loadKatex });
  m.session.set('n', 10);
  await m.settled();
  expect(document.querySelectorAll('[data-active-when], [data-active-value], [data-active-tex], [data-active-when-error]')).toHaveLength(0);
  expect(loadKatex).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain('Dead');
  m.destroy();
});
