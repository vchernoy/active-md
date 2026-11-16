// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

it('explains rejected edits, preserves descriptions, and clears on correction, peer update, reset and remount', () => {
  const root = document.createElement('div');
  root.innerHTML = renderActive('```calc\ninput x = 2 in 1..10\n```\n\n:input[x]{label="Count"} :input[x] :value[x]').html;
  const inputs = root.querySelectorAll('input');
  const input = inputs[0]!; const peer = inputs[1]!;
  input.setAttribute('aria-describedby', 'host-help');
  const live = mount(root);
  const id = input.getAttribute('aria-describedby')!.split(' ')[1];
  const message = root.querySelector(`#${id}`)!;
  expect(message.getAttribute('aria-live')).toBe('polite');
  expect(input.closest('label')!.contains(message)).toBe(false);
  const edit = (value: string, control = input) => { control.value = value; control.dispatchEvent(new Event('input')); };
  edit('0');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(message.textContent).toContain('enter a number from 1 to 10');
  expect(message.textContent).toContain('Results use the last accepted value.');
  expect(root.querySelector('output')!.textContent).toBe('2');
  edit('3'); expect(message.textContent).toBe('');
  edit(''); expect(message.textContent).toContain('enter a number');
  edit('4', peer); expect(message.textContent).toBe(''); expect(input.value).toBe('4');
  edit('0'); live.resetInputs(); expect(message.textContent).toBe('');
  edit(''); live.destroy();
  expect(input.getAttribute('aria-describedby')).toBe('host-help');
  expect(input.hasAttribute('aria-invalid')).toBe(false);
  expect(root.querySelectorAll('.active-input-problem')).toHaveLength(0);
  const again = mount(root);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(root.querySelector('.active-input-problem')!.textContent).toContain('enter a number');
  expect(root.querySelectorAll('.active-input-problem')).toHaveLength(2); again.destroy();
});

it('an empty first control does not suppress a valid restored peer', () => {
  const root = document.createElement('div');
  root.innerHTML = renderActive('```calc\ninput x = 2 in 1..10\n```\n\n:input[x] :input[x] :value[x]').html;
  const inputs = root.querySelectorAll('input');
  const first = mount(root);
  inputs[0]!.value = '4'; inputs[0]!.dispatchEvent(new Event('input'));
  inputs[0]!.value = ''; inputs[0]!.dispatchEvent(new Event('input'));
  first.destroy();
  const second = mount(root);
  expect(second.session.inputValues().get('x')).toBe(4);
  expect([...inputs].map(input => input.value)).toEqual(['4', '4']);
  expect(root.querySelector('output')!.textContent).toBe('4');
  expect([...root.querySelectorAll('.active-input-problem')].every(el => !el.textContent)).toBe(true);
  second.destroy();
});
