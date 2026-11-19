// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';
const choices = ':::select[Delivery]{input=delivery}\n::option[Standard]{value=10}\n::option[Express]{value=25}\n::option[Pickup]{value=0}\n:::';
const source = '```calc\ninput delivery = 10 in 0..30\ntotal = 100 + delivery\n```\n\n' + choices + '\n\n' + choices + '\n\n:edit{input=delivery}\n\n:value[total]\n\n:::when[delivery == 25]\nExpress selected\n:::';
const fixture = () => { const root = document.createElement('div'); root.innerHTML = renderActive(source).html; return root; };
it('restores, synchronizes select/numeric peers and dependencies and resets without mount events', () => {
  const root = fixture(); let events = 0; root.addEventListener('input', () => events++); root.addEventListener('change', () => events++);
  const live = mount(root, { initialInputs: new Map([['delivery', 25]]) });
  const selects = [...root.querySelectorAll('select')];
  expect(events).toBe(0); expect(selects.map(s => s.value)).toEqual(['25', '25']);
  expect(root.querySelector('[data-active-when]')?.hasAttribute('hidden')).toBe(false);
  selects[0]!.value = '0'; selects[0]!.dispatchEvent(new Event('change', { bubbles: true }));
  expect(live.session.inputValues().get('delivery')).toBe(0); expect(selects[1]!.value).toBe('0');
  expect(root.querySelector('input')?.value).toBe('0'); expect(root.querySelector('output')?.textContent).toBe('100');
  expect(root.querySelector('[data-active-when]')?.hasAttribute('hidden')).toBe(true);
  live.resetInputs(); expect(selects.map(s => s.value)).toEqual(['10', '10']); live.destroy();
});
it('rejects incompatible restored and public setter values without changing the model', () => {
  const root = fixture(), live = mount(root, { initialInputs: new Map([['delivery', 11]]) });
  expect(live.session.inputValues().get('delivery')).toBe(10);
  expect(live.session.set('delivery', 11)).toContain('available option');
  expect(live.session.inputValues().get('delivery')).toBe(10);
  expect(live.session.set('delivery', 25)).toBeUndefined(); expect(root.querySelector('select')?.value).toBe('25');
  const input = root.querySelector('input')!; input.value = '12'; input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(input.getAttribute('aria-invalid')).toBe('true'); expect(root.querySelector('select')?.value).toBe('25');
  live.resetInputs(); expect(input.value).toBe('10'); expect(input.hasAttribute('aria-invalid')).toBe(false); live.destroy();
});
it('adopts valid browser-restored select values and isolates mounts; destroy removes handlers', () => {
  const first = fixture(), second = fixture(); const select = first.querySelector('select')!; select.value = '0';
  const a = mount(first), b = mount(second); expect(a.session.inputValues().get('delivery')).toBe(0); expect(b.session.inputValues().get('delivery')).toBe(10);
  expect(first.querySelectorAll('select')[1]!.value).toBe('0'); a.destroy();
  select.value = '25'; select.dispatchEvent(new Event('change')); expect(a.session.inputValues().get('delivery')).toBe(0); b.destroy();
});

it('retains the default when a saved option was removed from the document', () => {
  const root = document.createElement('div'); root.innerHTML = renderActive(source.replaceAll('value=25', 'value=24')).html;
  const live = mount(root, { initialInputs: new Map([['delivery', 25]]) });
  expect(live.session.inputValues().get('delivery')).toBe(10);
  expect([...root.querySelectorAll('select')].map(select => select.value)).toEqual(['10', '10']); live.destroy();
});
