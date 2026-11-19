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
  first.querySelector<HTMLInputElement>('[type=radio][value="0"]')!.click();
  expect(a.session.inputValues().get('delivery')).toBe(0);
  expect(second.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value).toBe('25');
  expect(b.session.inputValues().get('delivery')).toBe(25);
  a.destroy();
  b.destroy();
  first.remove();
  second.remove();
});
