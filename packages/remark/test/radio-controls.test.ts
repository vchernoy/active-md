import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderActive } from '../src/index.js';

const calc = '```calc\ninput delivery = 10 in -10..30\n```\n\n';
const choices = ':::radio[Delivery]{input=delivery}\n::option[Standard]{value=10}\n::option[**Discount** & <img src=x onerror=bad>]{value=-0.5}\n::option[Pickup]{value=0}\n:::\n';

it('renders a native group with safe visible labels and one checked calc default', () => {
  const result = renderActive(calc + choices);
  expect(result.messages).toEqual([]);
  const doc = new JSDOM(result.html).window.document;
  const group = doc.querySelector('fieldset')!;
  expect(group.dataset.activeInput).toBe('delivery');
  expect(group.querySelector('legend')?.textContent).toBe('Delivery');
  expect([...group.querySelectorAll<HTMLInputElement>('label input[type=radio]')].map(option => [option.value, option.checked]))
    .toEqual([['10', true], ['-0.5', false], ['0', false]]);
  expect(group.querySelectorAll('label')[1]?.textContent).toContain('Discount &');
  expect(group.querySelector('img,[onerror]')).toBeNull();
});

it.each([
  [choices.replace('value=-0.5', 'value=10'), 'unique'],
  [choices.replace('value=10', 'value=11'), 'default'],
  [choices.replace('value=-0.5', 'value=Infinity'), 'finite'],
  [':::radio[Delivery]{input=delivery}\n:::\n', '1 to 256'],
  [choices + '\n' + choices.replace(':::radio', ':::select').replace('value=-0.5', 'value=-1'), 'same option'],
  [choices + '\n:edit{input=delivery min=0}', 'range of numeric controls'],
])('rejects incompatible radio declarations (%s)', (source, message) => {
  expect(renderActive(calc + source).messages).toEqual([
    expect.objectContaining({ line: expect.any(Number), column: 1, message: expect.stringContaining(message) }),
  ]);
});

it('includes radio groups in conditional control reachability', () => {
  const selfHiding = calc + '::::when[delivery]\n' + choices + '::::';
  expect(renderActive(selfHiding).messages).toContainEqual(
    expect.objectContaining({ line: 5, message: expect.stringContaining('only control') }),
  );
  const outsideRadio = calc + choices + '\n:::when[delivery]\n:edit{input=delivery}\n:::';
  expect(renderActive(outsideRadio).messages).toEqual([]);
});
