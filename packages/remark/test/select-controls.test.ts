import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderActive } from '../src/index.js';
const calc = '```calc\ninput delivery = 10 in -10..30\ntotal = 100 + delivery\n```\n\n';
const choices = ':::select[Delivery]{input=delivery}\n::option[Standard]{value=10}\n::option[Express]{value=25}\n::option[Pickup]{value=0}\n:::\n';
it('renders a labeled single native select with the calc default, safe labels and numeric values', () => {
  const result = renderActive(calc + choices + '\n:value[total]');
  expect(result.messages).toEqual([]);
  const doc = new JSDOM(result.html).window.document;
  const select = doc.querySelector('select')!;
  expect(select.multiple).toBe(false); expect(select.value).toBe('10');
  expect(select.getAttribute('aria-label')).toBe('Delivery');
  expect(select.closest('label')?.textContent).toContain('Delivery');
  expect([...select.options].map(o => [o.text, o.value, o.selected])).toEqual([['Standard', '10', true], ['Express', '25', false], ['Pickup', '0', false]]);
  expect(doc.querySelector('output')?.textContent).toBe('110');
});
it.each([
  [choices.replace('value=25', 'value=10'), 'unique'],
  [choices.replace('value=10', 'value=11'), 'default'],
  [choices.replace('value=25', 'value=Infinity'), 'finite'],
  [choices.replace('value=25', 'value=31'), 'range'],
  [choices.replace('value=25', 'value=""'), 'finite'],
  [choices.replace('[Express]', '[]'), 'nonempty'],
  [choices.replace('input=delivery', 'input=total'), 'declared'],
  [choices.replace('input=delivery', 'input=missing'), 'declared'],
  [choices.replace('[Delivery]', '[]'), 'label'],
  [choices.replace('input=delivery', 'input=delivery value=25'), 'only'],
  [choices.replace('value=25', 'value=25 onclick=bad'), 'only'],
  [':::select[Delivery]{input=delivery}\n:::\n', '1 to 256'],
  [choices.replace('::option[Express]{value=25}', 'Unexpected prose'), 'children'],
])('rejects invalid select declarations with positions: %s', (source, message) => {
  const result = renderActive(calc + source);
  expect(result.messages).toHaveLength(1); expect(result.messages[0]).toMatchObject({ line: 6, column: 1 });
  expect(result.messages[0]!.message).toContain(message); expect(result.html).not.toContain('<select');
});
it('accepts reordered equivalent domains and rejects conflicting domains', () => {
  expect(renderActive(calc + choices + '\n' + choices.replace('::option[Standard]{value=10}\n::option[Express]{value=25}', '::option[Express]{value=25.0}\n::option[Standard]{value=10}')).messages).toEqual([]);
  expect(renderActive(calc + choices + '\n' + choices.replace('value=25', 'value=24')).messages[0]?.message).toContain('same option');
});
it('supports decimal, negative and zero values and rejects negative-zero duplicates', () => {
  expect(renderActive(calc + choices.replace('value=25', 'value=-0.5')).messages).toEqual([]);
  expect(renderActive(calc + choices.replace('value=25', 'value=-0')).messages[0]?.message).toContain('unique');
});
it('bounds option count before building controls', () => {
  const source = '```calc\ninput x = 0\n```\n\n:::select[X]{input=x}\n' + Array.from({ length: 257 }, (_, n) => `::option[${n}]{value=${n}}`).join('\n') + '\n:::';
  expect(renderActive(source).messages[0]?.message).toContain('256');
});
it('uses safe text labels and escapes label attributes', () => {
  const result = renderActive(calc + choices.replace('[Delivery]', '[<img src=x onerror=bad>]').replace('[Express]', '[**Express** & <script>bad</script>]'));
  expect(result.messages).toEqual([]); const doc = new JSDOM(result.html).window.document;
  expect(doc.querySelectorAll('img,script,[onerror]')).toHaveLength(0);
  expect(doc.querySelectorAll('option')[1]?.textContent).toContain('Express &');
});
it('includes select controls in reachability and seed exclusions', () => {
  expect(renderActive(calc + '::::when[delivery]\n' + choices + '\n::::').messages.some(m => m.message.includes('only control'))).toBe(true);
  const source = calc + choices + '\n:::question{type=number}\n:answer[10]\n:::\n\n::quiz-submit[Check]{seed=delivery}';
  expect(renderActive(source).messages.some(m => m.message.includes('reader-editable'))).toBe(true);
});

it.each([true, false])('rejects options outside a numeric peer range independent of source order (%s)', first => {
  const numeric = ':edit{input=delivery max=20}';
  const result = renderActive(calc + (first ? choices + '\n' + numeric : numeric + '\n\n' + choices));
  expect(result.messages.some(m => m.message.includes('range of numeric controls'))).toBe(true);
  expect(result.html).not.toContain('<select');
});
