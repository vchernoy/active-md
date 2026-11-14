// @vitest-environment jsdom
import { renderActive } from '@vchernoy/remark-active';
import katex from 'katex';
import { describe, expect, it, vi } from 'vitest';
import { mount } from '../src/index.js';

const calc = (src: string) => '```calc\n' + src + '\n```\n\n';

function setup(md: string, opts: Parameters<typeof mount>[1] = {}) {
  const host = document.createElement('div');
  host.innerHTML = renderActive(md, { locale: 'en-US' }).html;
  document.body.append(host);
  const loadKatex = vi.fn(async () => katex);
  const m = mount(host, { locale: 'en-US', loadKatex, ...opts });
  const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T & HTMLElement>(sel)!;
  const type = (sel: string, value: string) => {
    const el = $<HTMLInputElement>(sel);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return { host, m, $, type, loadKatex };
}

const SRC = calc('input p = 1000 in 0..1000000\ninput r = 5 in 0..100\nf = p * (1 + r / 100)') +
  ':input[p] :input[r]{widget=slider} → :value[f]{format=fixed:2} and :value[r * 2]\n\n$$ f = {{f}} $$\n\nPlain $x^2$';

describe('mount', () => {
  it('updates views when an input changes', () => {
    const { $, type } = setup(SRC);
    expect($('[data-active-value="f"]').textContent).toBe('1,050.00');
    type('[data-active-input="p"]', '2000');
    expect($('[data-active-value="f"]').textContent).toBe('2,100.00');
    expect($('[data-active-value="r * 2"]').textContent).toBe('10');
  });

  it('updates the slider readout', () => {
    const { $, type } = setup(SRC);
    type('[data-active-input="r"]', '10');
    expect($('output[data-active-value="r"]').textContent).toBe('10');
    expect($('[data-active-value="f"]').textContent).toBe('1,100.00');
  });

  it('re-renders only formulas that use changed values, loading KaTeX lazily', async () => {
    const { $, m, type, loadKatex } = setup(SRC);
    expect(loadKatex).not.toHaveBeenCalled();
    const plain = $('[data-active-tex="x^2"]').innerHTML;
    type('[data-active-input="p"]', '2000');
    await m.settled();
    expect(loadKatex).toHaveBeenCalledTimes(1);
    expect($('[data-active-tex="f = {{f}}"]').innerHTML).toContain('<mn>2100</mn>');
    expect($('[data-active-tex="x^2"]').innerHTML).toBe(plain);
  });

  it('rejects out-of-range and empty values without changing results', () => {
    const { $, type } = setup(SRC);
    type('[data-active-input="p"]', '-5');
    const p = $<HTMLInputElement>('[data-active-input="p"]');
    expect(p.getAttribute('aria-invalid')).toBe('true');
    expect(p.title).toBe('enter a number from 0 to 1000000');
    expect(p.validationMessage).toBe('enter a number from 0 to 1000000');
    expect($('[data-active-value="f"]').textContent).toBe('1,050.00');
    type('[data-active-input="p"]', '');
    expect(p.title).toBe('enter a number');
    type('[data-active-input="p"]', '10');
    expect(p.hasAttribute('aria-invalid')).toBe(false);
    expect(p.title).toBe('');
    expect($('[data-active-value="f"]').textContent).toBe('10.50');
  });

  it('shows and clears runtime errors', () => {
    const { $, type } = setup(calc('input d = 1\nq = 10 / d') + ':input[d] :value[q]');
    type('[data-active-input="d"]', '0');
    expect($('[data-active-value="q"]').textContent).toBe('⚠ division by zero');
    expect($('[data-active-value="q"]').classList.contains('active-error')).toBe(true);
    type('[data-active-input="d"]', '4');
    expect($('[data-active-value="q"]').textContent).toBe('2.5');
    expect($('[data-active-value="q"]').classList.contains('active-error')).toBe(false);
  });

  it('adopts values the browser restored into controls', () => {
    const host = document.createElement('div');
    host.innerHTML = renderActive(calc('input n = 2\nm = n * 10') + ':input[n] :value[m]', { locale: 'en-US' }).html;
    host.querySelector<HTMLInputElement>('input')!.value = '7';
    const m = mount(host, { locale: 'en-US' });
    expect(m.session.inputValues().get('n')).toBe(7);
    expect(host.querySelector('output')!.textContent).toBe('70');
  });

  it('stops listening after destroy', () => {
    const { $, m, type } = setup(SRC);
    m.destroy();
    type('[data-active-input="p"]', '2000');
    expect($('[data-active-value="f"]').textContent).toBe('1,050.00');
  });

  it('tolerates documents without calc or with a tampered program', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="active-doc" data-active-calc="{not json"><p>Hi</p></div>';
    expect(mount(host).program.definitions).toEqual([]);
    host.innerHTML = '<div class="active-doc" data-active-calc="[1, &quot;x = 1&quot;]"></div>';
    expect(mount(host).program.definitions.map(d => d.name)).toEqual(['x']);
    expect(() => mount(document.createElement('div'))).toThrow(/no .active-doc/);
  });

  it('ignores views and controls the renderer already marked as errors', () => {
    const { $, type } = setup(calc('input a = 1') + ':value[nope] :input[a] :value[a]');
    type('[data-active-input="a"]', '3');
    expect($('[data-active-value="a"]').textContent).toBe('3');
    expect($('.active-error').textContent).toBe('⚠ unknown name "nope"');
  });
});

describe('review fixes (#5)', () => {
  it("enforces the control's narrowed range, also for restored values", () => {
    const { $, m, type } = setup(calc('input x = 5 in 0..100\ny = x * 2') + ':input[x]{min=0 max=10} :value[y]');
    type('[data-active-input="x"]', '50');
    const x = $<HTMLInputElement>('[data-active-input="x"]');
    expect(x.getAttribute('aria-invalid')).toBe('true');
    expect(x.title).toBe('enter a number from 0 to 10');
    expect(m.session.inputValues().get('x')).toBe(5);
    expect($('[data-active-value="y"]').textContent).toBe('10');

    const host = document.createElement('div');
    host.innerHTML = renderActive(calc('input n = 2 in 0..100') + ':input[n]{max=10}', { locale: 'en-US' }).html;
    host.querySelector<HTMLInputElement>('input')!.value = '50';
    expect(mount(host).session.inputValues().get('n')).toBe(2);
  });

  it('updates formulas of a detached document, so inserting it later shows current values', async () => {
    const host = document.createElement('div');
    host.innerHTML = renderActive(calc('input n = 2') + ':input[n] $n = {{n}}$', { locale: 'en-US' }).html;
    host.querySelector<HTMLInputElement>('input')!.value = '7';
    const m = mount(host, { loadKatex: async () => katex });
    await m.settled();
    expect(host.querySelector('[data-active-tex]')!.innerHTML).toContain('<mn>7</mn>');
  });

  it('drops pending formula renders after destroy', async () => {
    let release!: (k: typeof katex) => void;
    const gate = new Promise<typeof katex>(r => { release = r; });
    const { $, m, type } = setup(SRC, { loadKatex: () => gate });
    const before = $('[data-active-tex="f = {{f}}"]').innerHTML;
    type('[data-active-input="p"]', '2000');
    m.destroy();
    release(katex);
    await m.settled();
    expect($('[data-active-tex="f = {{f}}"]').innerHTML).toBe(before);
  });
});

describe('several controls for one input', () => {
  const DOC = calc('input r = 8 in 0..30\ny = r * 2') + 'Rate :input[r] :input[r]{widget=slider step=0.5} → :value[y]';
  const both = (host: ReturnType<typeof setup>) => [...host.host.querySelectorAll<HTMLInputElement>('[data-active-input="r"]')];
  const type = (el: HTMLInputElement, value: string) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };

  it('keeps the number box and the slider in sync, both ways', () => {
    const s = setup(DOC);
    const [box, slider] = both(s);
    type(box!, '12');
    expect(slider!.value).toBe('12');
    expect(s.$('[data-active-value="y"]').textContent).toBe('24');
    type(slider!, '20.5');
    expect(box!.value).toBe('20.5');
    expect(s.$('[data-active-value="y"]').textContent).toBe('41');
  });

  it('never rewrites the control being typed in, and leaves the other one alone on invalid input', () => {
    const s = setup(DOC);
    const [box, slider] = both(s);
    type(box!, '12.0');
    expect(box!.value).toBe('12.0');
    type(box!, '99');
    expect(box!.getAttribute('aria-invalid')).toBe('true');
    expect(slider!.value).toBe('12');
    // Fixing the value elsewhere clears the stale error on the box and shows the current value.
    type(slider!, '5');
    expect(box!.value).toBe('5');
    expect(box!.hasAttribute('aria-invalid')).toBe(false);
  });

  it('syncs the other controls when a restored value is adopted', () => {
    const host = document.createElement('div');
    host.innerHTML = renderActive(DOC, { locale: 'en-US' }).html;
    host.querySelector<HTMLInputElement>('input[type="number"]')!.value = '7';
    mount(host, { locale: 'en-US' });
    expect(host.querySelector<HTMLInputElement>('input[type="range"]')!.value).toBe('7');
  });
});

describe('several controls: review fixes (#10)', () => {
  const type = (el: HTMLInputElement, value: string) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };

  it('repairs an invalid control when another submits the current value', () => {
    const s = setup(calc('input r = 8 in 0..30') + ':input[r] :input[r]');
    const [a, b] = [...s.host.querySelectorAll<HTMLInputElement>('[data-active-input="r"]')];
    type(a!, '99');
    expect(a!.getAttribute('aria-invalid')).toBe('true');
    type(b!, '8'); // unchanged model value: no session notification
    expect(a!.value).toBe('8');
    expect(a!.hasAttribute('aria-invalid')).toBe(false);
  });

  it('keeps an off-step value in the model and readout while the slider shows the nearest step', () => {
    const s = setup(calc('input r = 8 in 0..30') + ':input[r] :input[r]{widget=slider step=0.5}');
    const box = s.$<HTMLInputElement>('input[type="number"]');
    type(box, '8.1');
    expect(s.m.session.get('r')).toEqual({ kind: 'value', value: 8.1 });
    // Browsers snap a range input to its step (jsdom doesn't); either way it stays within half a step.
    expect(Math.abs(Number(s.$<HTMLInputElement>('input[type="range"]').value) - 8.1)).toBeLessThanOrEqual(0.25);
    expect(s.$('output[data-active-value="r"]').textContent).toBe('8.1');
    expect(box.value).toBe('8.1');
  });

  it('does not mistake a slider rounded by syncing for a restored value', () => {
    const host = document.createElement('div');
    host.innerHTML = renderActive(calc('input r = 5 in 0..30') + ':input[r] :input[r]{widget=slider step=0.5}', { locale: 'en-US' }).html;
    host.querySelector<HTMLInputElement>('input[type="number"]')!.value = '8.1';
    // Snap the slider to its step on assignment, as browsers do.
    const slider = host.querySelector<HTMLInputElement>('input[type="range"]')!;
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
    Object.defineProperty(slider, 'value', {
      get() { return proto.get!.call(this); },
      set(v: string) { proto.set!.call(this, String(Math.round(Number(v) / 0.5) * 0.5)); },
    });
    const m = mount(host, { locale: 'en-US' });
    expect(slider.value).toBe('8');
    expect(m.session.get('r')).toEqual({ kind: 'value', value: 8.1 });
  });
});
