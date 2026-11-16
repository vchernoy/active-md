// @vitest-environment jsdom
import { expect, it } from 'vitest';
import katex from 'katex';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

const source = '```calc\ninput x = 2 in 0..10\ninput seed = 3 in 0..20\ny = x + seed\n```\n\n:input[x]{min=1 max=6} :input[x]{widget=slider min=1 max=6 step=1}\n\n:value[y]\n\n$y={{y}}$\n\n:::when[x > 4]\nShown\n:::';
function fixture(text = source) {
  const root = document.createElement('div'); root.innerHTML = renderActive(text).html;
  return root;
}

it('restores model-only and rendered inputs before host subscriptions and agrees across views', async () => {
  const root = fixture();
  // Accepted explicit state takes precedence over browser-restored controls.
  root.querySelector<HTMLInputElement>('input')!.value = '6';
  const live = mount(root, { initialInputs: new Map([['x', 5], ['seed', 7], ['unknown', 9], ['y', 100]]), loadKatex: async () => katex });
  let notifications = 0; live.session.subscribe(() => notifications++);
  await live.settled();
  expect([...live.session.inputValues()]).toEqual([['x', 5], ['seed', 7]]);
  expect([...root.querySelectorAll('input')].map(el => el.value)).toEqual(['5', '5']);
  expect(root.querySelector('output[data-active-value="y"]')?.textContent).toBe('12');
  expect(root.querySelector('math mn')?.textContent).toBe('12');
  expect(root.querySelector<HTMLElement>('[data-active-when]')?.hidden).toBe(false);
  expect(notifications).toBe(0);
  expect(root.querySelector<HTMLElement>('.active-doc')?.dataset.activeCalc).toContain('input x = 2');
  live.resetInputs(); await live.settled();
  expect([...live.session.inputValues()]).toEqual([['x', 2], ['seed', 3]]);
  expect([...root.querySelectorAll('input')].map(el => el.value)).toEqual(['2', '2']);
  expect(root.querySelector('output[data-active-value="y"]')?.textContent).toBe('5');
  expect(root.querySelector('math mn')?.textContent).toBe('5');
  expect(root.querySelector<HTMLElement>('[data-active-when]')?.hidden).toBe(true);
  expect(notifications).toBe(1); // reset is one model operation, not one per input.
  live.destroy();
});

it.each([NaN, Infinity, -Infinity, -1, 7, 11, '5' as unknown as number])('skips invalid or out-of-model/control-range restored x=%s', async value => {
  const root = fixture();
  const live = mount(root, { initialInputs: new Map([['x', value]]), loadKatex: async () => katex });
  await live.settled();
  expect(live.session.inputValues().get('x')).toBe(2);
  expect([...root.querySelectorAll('input')].map(el => el.value)).toEqual(['2', '2']);
  expect(root.querySelector('output[data-active-value="y"]')?.textContent).toBe('5');
  live.destroy();
});

it('checks every peer control bound, and retains autofill behavior for rejected entries', async () => {
  const root = fixture('```calc\ninput x = 2 in 0..10\n```\n\n:input[x] :value[x]');
  // A host may supply stricter controls than the model; an initial snapshot must satisfy all of them.
  const peer = document.createElement('input'); peer.type = 'number'; peer.dataset.activeInput = 'x'; peer.max = '4'; peer.defaultValue = '2';
  root.querySelector('.active-doc')!.append(peer);
  root.querySelector<HTMLInputElement>('input')!.value = '3';
  const live = mount(root, { initialInputs: new Map([['x', 5]]) });
  expect(live.session.inputValues().get('x')).toBe(3);
  expect([...root.querySelectorAll('input')].map(el => el.value)).toEqual(['3', '3']);
  live.destroy();
});

it('keeps controls synchronized for public model setters and clears unfinished invalid text on reset', async () => {
  const root = fixture(); const live = mount(root, { loadKatex: async () => katex });
  expect(live.session.set('x', 5)).toBeUndefined(); await live.settled();
  expect([...root.querySelectorAll('input')].map(el => el.value)).toEqual(['5', '5']);
  live.session.reset(); await live.settled();
  const input = root.querySelector<HTMLInputElement>('input')!;
  input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(input.getAttribute('aria-invalid')).toBe('true');
  live.resetInputs(); await live.settled();
  expect(input.value).toBe('2'); expect(input.hasAttribute('aria-invalid')).toBe(false);
  expect(input.validationMessage).toBe('');
  live.destroy();
});

it('does not rewrite a control being edited while synchronizing its peers', () => {
  const root = fixture(); const live = mount(root);
  const input = root.querySelector<HTMLInputElement>('input')!;
  input.value = '3.0'; input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(input.value).toBe('3.0'); expect(root.querySelectorAll('input')[1]!.value).toBe('3');
  live.destroy();
});
