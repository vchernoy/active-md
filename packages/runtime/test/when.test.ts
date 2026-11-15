// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';
const model = '```calc\ninput x = 0\ninput extra = 7\ntotal = 10 + if(x, extra, 0)\n```\n\n:input[x]\n\n:value[total]\n\n';
describe('when runtime', () => {
  it('agrees with the renderer, preserves hidden input values and gates results', async () => {
    const source = model + ':::when[x]\n:input[extra]\n\n:value[extra]\n:::';
    document.body.innerHTML = renderActive(source).html;
    const m = mount(document.body);
    const block = document.querySelector<HTMLElement>('[data-active-when]')!;
    const x = document.querySelector<HTMLInputElement>('[data-active-input="x"]')!;
    expect(block.hidden).toBe(true);
    x.value = '1'; x.dispatchEvent(new Event('input'));
    expect(block.hidden).toBe(false);
    m.session.set('extra', 9);
    expect(document.querySelector('[data-active-value="total"]')?.textContent).toBe('19');
    x.value = '0'; x.dispatchEvent(new Event('input'));
    expect(block.hidden).toBe(true);
    expect(m.session.get('extra')).toEqual({ kind: 'value', value: 9 });
    expect(document.querySelector('[data-active-value="total"]')?.textContent).toBe('10');
    expect(renderActive(source.replace('input x = 0', 'input x = 1')).html).not.toMatch(/data-active-when="x"[^>]*hidden/);
    m.destroy();
  });
  it('does not evaluate/render hidden subtrees or announce their failures', async () => {
    const load = vi.fn(async () => ({ renderToString: vi.fn(() => '<math>visible</math>') }));
    document.body.innerHTML = renderActive(model + '::::when[x]\n$$ {{1/x}} $$\n\n:::when[1/0]\n:value[unknown]\n:::\n::::').html;
    const m = mount(document.body, { loadKatex: load });
    m.session.set('extra', 8);
    await m.settled();
    expect(load).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('division by zero');
    m.session.set('x', 1);
    await m.settled();
    expect(load).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLElement>('[data-active-when="1/0"]')?.hidden).toBe(true);
    expect(document.querySelector('[data-active-when-error="2"]')?.textContent).toContain('division by zero');
    m.session.set('x', 0);
    expect(document.querySelector('[data-active-when-error="2"]')?.textContent).toBe('');
    m.destroy();
  });
});

it('refreshes nested bindings only when their own and enclosing conditions are true', async () => {
  const source = model + '::::when[x]\n:::when[extra > 0]\n:value[1/extra]\n:::\n::::';
  document.body.innerHTML = renderActive(source).html;
  const m = mount(document.body);
  const inner = document.querySelector<HTMLElement>('[data-active-when="extra > 0"]')!;
  expect(inner.hidden).toBe(true);
  m.session.set('extra', 0);
  m.session.set('x', 1);
  expect(inner.hidden).toBe(true);
  expect(inner.textContent).not.toContain('division');
  m.session.set('extra', 2);
  expect(inner.hidden).toBe(false);
  expect(inner.querySelector('output')!.textContent).toBe('0.5');
  m.session.set('x', 0);
  expect(inner.hidden).toBe(true);
  m.session.set('extra', 4);
  m.session.set('x', 1);
  expect(inner.querySelector('output')!.textContent).toBe('0.25');
  m.destroy();
});
