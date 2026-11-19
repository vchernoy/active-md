// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';
const source = '```calc\ninput x = 2 in 0..10\ny = x * 3\n```\n\nStart :edit[Investment]{input=x}, then :input[x].\n\n::slider[Amount]{input=x step=1}\n\n:value[y]';
const fixture = () => { const root = document.createElement('div'); root.innerHTML = renderActive(source).html; return root; };
it('restores accepted values, synchronizes mixed controls and resets without mount events', () => {
  const root = fixture(), event = vi.fn(); root.addEventListener('input', event); root.addEventListener('change', event);
  const live = mount(root, { initialInputs: new Map([['x', 7]]) });
  const controls = [...root.querySelectorAll<HTMLInputElement>('input')];
  expect(controls.map(control => control.value)).toEqual(['7', '7', '7']); expect(event).not.toHaveBeenCalled();
  expect(root.querySelector('input')!.getAttribute('aria-label')).toBe('Investment');
  controls[0]!.value = '9'; controls[0]!.dispatchEvent(new Event('input', { bubbles: true }));
  expect(controls.map(control => control.value)).toEqual(['9', '9', '9']); expect(live.session.inputValues().get('x')).toBe(9);
  live.resetInputs(); expect(controls.map(control => control.value)).toEqual(['2', '2', '2']); live.destroy();
});
it('rejects incompatible restored values without overriding authored defaults', () => {
  const root = fixture(), live = mount(root, { initialInputs: new Map([['x', 11]]) });
  expect(live.session.inputValues().get('x')).toBe(2); expect([...root.querySelectorAll<HTMLInputElement>('input')].map(control => control.value)).toEqual(['2', '2', '2']); live.destroy();
});
it('keeps independent mounts isolated on the same document', () => {
  const first = fixture(), second = fixture(), a = mount(first), b = mount(second, { initialInputs: new Map([['x', 4]]) });
  const control = first.querySelector<HTMLInputElement>('input')!; control.value = '8'; control.dispatchEvent(new Event('input', { bubbles: true }));
  expect(a.session.inputValues().get('x')).toBe(8); expect(b.session.inputValues().get('x')).toBe(4); a.destroy(); b.destroy();
});
