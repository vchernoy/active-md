// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

it('prepares definitions, conditions, values and math consistently before and after live changes', async () => {
  const source = '```calc\nx = 10\ny = x + 5\ninput n = 0 in 0..10\nz = n + y * 2\n```\n\n:input[n]\n\n:value[z] :value[y+5]\n\n$x={{z}}$\n\n:::when[n > 20]\nNever\n:::\n\n:::when[n > 5]\n:value[z]\n:::\n\n:::when[x > 5]\nConstant\n:::';
  const r = renderActive(source);
  expect(r.messages).toEqual([]);
  document.body.innerHTML = r.html;
  const gates = [...document.querySelectorAll<HTMLElement>('[data-active-when]')];
  expect(gates.map(g => g.dataset.activeWhenConstant)).toEqual([undefined, '1']);
  const initial = [...document.querySelectorAll('output')].map(o => o.textContent);
  const m = mount(document.body);
  expect([...document.querySelectorAll('output')].map(o => o.textContent)).toEqual(initial);
  expect(m.program.definitions.find(d => d.name === 'y')).toMatchObject({ expr: { kind: 'num', value: 15 } });
  expect([...m.session.compile('n + y*2').deps]).toEqual(['n']);
  m.session.set('n', 10);
  await m.settled();
  expect(gates.map(g => g.hidden)).toEqual([false, false]);
  expect(document.querySelector('output')!.textContent).toBe('40');
  expect(document.querySelector('math')!.textContent).toContain('40');
  const server = document.createElement('div');
  server.innerHTML = renderActive(source.replace('input n = 0', 'input n = 10')).html;
  expect([...document.querySelectorAll('output')].map(o => o.textContent)).toEqual([...server.querySelectorAll('output')].map(o => o.textContent));
  expect(document.querySelector('math')!.outerHTML).toBe(server.querySelector('math')!.outerHTML);
  expect(m.session.set('n', 20)).toContain('0 to 10');
  m.destroy();
});

it('retains positioned errors and hidden-expression laziness after preparation', async () => {
  const source = '```calc\nx = 2 + 3\ninput n = 0 in 0..10\n```\n\n:input[n]\n\n:::when[n]\n:value[log(-1) + x]\n\n$y={{1/0 + x}}$\n:::\n\n:::when[1/0]\nBad\n:::';
  const r = renderActive(source);
  expect(r.messages).toHaveLength(1);
  expect(r.messages[0]).toMatchObject({ line: 14, column: 1, message: expect.stringContaining('division by zero') });
  document.body.innerHTML = r.html;
  const m = mount(document.body);
  expect(document.querySelector('[data-active-value]')!.textContent).toBe('');
  m.session.set('n', 1);
  await m.settled();
  expect(document.querySelector('[data-active-value]')!.textContent).toContain('log: argument must be positive');
  expect(document.querySelector('math')!.textContent).toContain('?');
  expect(m.session.compile('1/0 + x', 'math').evaluate()).toMatchObject({ kind: 'error', span: { block: 'math', column: 1 } });
  m.destroy();
});
