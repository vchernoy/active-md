// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

const choices = ':::radio[Delivery]{input=delivery}\n::option[Standard]{value=10}\n::option[Express]{value=25}\n::option[Pickup]{value=0}\n:::';
const source = '```calc\ninput delivery = 10 in 0..30\ntotal = 100 + delivery\n```\n\n' + choices + '\n\n' + choices.replace(':::radio', ':::select') +
  '\n\n:edit{input=delivery}\n\n:value[total]\n\n:::when[delivery == 25]\nExpress selected\n:::';

function fixture() {
  const root = document.createElement('div');
  root.innerHTML = renderActive(source).html;
  return root;
}

it('restores, updates dependent views and peers, and resets without synthetic events', () => {
  const root = fixture();
  document.body.append(root);
  let events = 0;
  root.addEventListener('change', () => events++);
  root.addEventListener('input', () => events++);
  const live = mount(root, { initialInputs: new Map([['delivery', 25]]) });
  expect(events).toBe(0);
  expect(root.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value).toBe('25');
  expect(root.querySelector('[data-active-when]')?.hasAttribute('hidden')).toBe(false);
  const pickup = root.querySelector<HTMLInputElement>('input[type=radio][value="0"]')!;
  pickup.click();
  expect(live.session.inputValues().get('delivery')).toBe(0);
  expect(root.querySelector('select')?.value).toBe('0');
  expect(root.querySelector<HTMLInputElement>('input[type=number]')?.value).toBe('0');
  expect(root.querySelector('output')?.textContent).toBe('100');
  expect(root.querySelector('[data-active-when]')?.hasAttribute('hidden')).toBe(true);
  expect(live.session.set('delivery', 11)).toContain('available option');
  live.resetInputs();
  expect(root.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value).toBe('10');
  live.destroy();
  pickup.click();
  expect(live.session.inputValues().get('delivery')).toBe(10);
  root.remove();
});

it('uses the calc default for an unavailable saved value and keeps separate mounts independent', () => {
  const first = fixture(), second = fixture();
  document.body.append(first, second);
  const a = mount(first, { initialInputs: new Map([['delivery', 11]]) });
  const b = mount(second, { initialInputs: new Map([['delivery', 25]]) });
  expect(a.session.inputValues().get('delivery')).toBe(10);
  expect(first.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value).toBe('10');
  expect(first.querySelector('select')?.value).toBe('10');
  expect(first.querySelector<HTMLInputElement>('input[type=number]')?.value).toBe('10');
  expect(first.querySelector('output')?.textContent).toBe('110');
  first.querySelector<HTMLInputElement>('[type=radio][value="0"]')!.click();
  expect(a.session.inputValues().get('delivery')).toBe(0);
  expect(second.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value).toBe('25');
  expect(b.session.inputValues().get('delivery')).toBe(25);
  a.destroy();
  b.destroy();
  first.remove();
  second.remove();
});

// Default is deliberately not the first option; checked properties simulate browser
// restoration without changing authored defaultChecked or dispatching user events.
function restoredRadio(value = 25) {
  const root = document.createElement('div');
  root.innerHTML = renderActive(source.replaceAll(
    '::option[Standard]{value=10}\n::option[Express]{value=25}',
    '::option[Express]{value=25}\n::option[Standard]{value=10}',
  )).html;
  const radios = [...root.querySelectorAll<HTMLInputElement>('input[type=radio]')];
  for (const radio of radios) radio.checked = Number(radio.value) === value;
  return root;
}

function expectValues(root: HTMLElement, value: number, total: number) {
  expect([...root.querySelectorAll<HTMLInputElement>('input[type=radio]')].filter(radio => radio.checked).map(radio => radio.value)).toEqual([String(value)]);
  expect(root.querySelector('select')?.value).toBe(String(value));
  expect(root.querySelector<HTMLInputElement>('input[type=number]')?.value).toBe(String(value));
  expect(root.querySelector('output')?.textContent).toBe(String(total));
  expect(root.querySelector('[data-active-when]')?.hasAttribute('hidden')).toBe(value !== 25);
}

it('adopts browser-restored checked state with a later default, synchronizes peers and resets', () => {
  const root = restoredRadio(); document.body.append(root);
  const radios = [...root.querySelectorAll<HTMLInputElement>('input[type=radio]')];
  expect(radios.map(radio => radio.defaultChecked)).toEqual([false, true, false]);
  let events = 0;
  root.addEventListener('input', () => events++); root.addEventListener('change', () => events++);
  const live = mount(root);
  expect(live.session.inputValues().get('delivery')).toBe(25); expectValues(root, 25, 125);
  expect(events).toBe(0);
  live.resetInputs(); expect(live.session.inputValues().get('delivery')).toBe(10); expectValues(root, 10, 110);
  expect(events).toBe(0); expect(radios.map(radio => radio.defaultChecked)).toEqual([false, true, false]);
  live.destroy(); root.remove();
});

it.each([0, 10])('explicit accepted initial value %s wins over browser-restored radios without mount events', value => {
  const root = restoredRadio(); document.body.append(root);
  let events = 0;
  root.addEventListener('input', () => events++); root.addEventListener('change', () => events++);
  const live = mount(root, { initialInputs: new Map([['delivery', value]]) });
  expect(live.session.inputValues().get('delivery')).toBe(value); expectValues(root, value, 100 + value);
  expect(events).toBe(0); live.destroy(); root.remove();
});

it('an unavailable initial value keeps a later-in-order calc default before any interaction', () => {
  const root = restoredRadio(10); document.body.append(root);
  expect(root.querySelector<HTMLInputElement>('input[type=radio]')?.value).toBe('25');
  const live = mount(root, { initialInputs: new Map([['delivery', 11]]) });
  expect(live.session.inputValues().get('delivery')).toBe(10); expectValues(root, 10, 110);
  live.destroy(); root.remove();
});
