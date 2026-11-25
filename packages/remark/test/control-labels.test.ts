import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderActive } from '../src/index.js';

const calc = '```calc\nbase = 100\nvalue = 7\ninput plan = base in 100..200\ninput test = 0\ndependent = test * 0\n```\n\n';

it('renders static numeric labels with a scoped option value and normal group and inline scope', () => {
  const source = calc + [
    ':edit[Base {{base}} and {{value}}]{input=test}',
    '::slider[Rate {{sqrt(base)}}]{input=plan}',
    ':::select[Plan {{value}}]{input=plan}\n::option[Monthly {{value}}]{value=base}\n::option[Monthly {{value}}]{value="base * 2"}\n:::',
    ':::radio[Plan {{base}}]{input=plan}\n::option[Annual {{value*12*1}}]{value=base}\n::option[Annual {{value * 12 + base}}]{value=200}\n:::',
  ].join('\n\n');
  const result = renderActive(source, { locale: 'en-US' });
  expect(result.messages).toEqual([]);
  const doc = new JSDOM(result.html).window.document;
  expect(doc.querySelector('input[type=number]')?.getAttribute('aria-label')).toBe('Base 100 and 7');
  expect(doc.querySelector('.active-input-label')?.textContent).toBe('Rate 10');
  expect(doc.querySelector('select')?.getAttribute('aria-label')).toBe('Plan 7');
  expect([...doc.querySelectorAll('option')].map(node => node.textContent)).toEqual(['Monthly 100', 'Monthly 200']);
  expect(doc.querySelector('legend')?.textContent).toBe('Plan 100');
  expect([...doc.querySelectorAll('fieldset label')].map(node => node.textContent)).toEqual(['Annual 1,200', 'Annual 2,500']);
});

it.each([
  ['{{test}}', 'depends on a Calc input'],
  ['{{dependent}}', 'depends on a Calc input'],
  ['{{if(0, test, 5)}}', 'depends on a Calc input'],
  ['{{unknown}}', 'unknown name'],
  ['{{1/0}}', 'zero'],
  ['{{', 'unclosed interpolation'],
  ['{{}}', 'malformed interpolation'],
  ['{{{{base}}}}', 'malformed interpolation'],
])('preserves invalid interpolation %s and reports it at the label', (literal, diagnostic) => {
  const result = renderActive(calc + `::edit[Label ${literal}]{input=test}`);
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0]).toMatchObject({ line: 9, column: 1 });
  expect(result.messages[0]?.message).toContain(diagnostic);
  expect(new JSDOM(result.html).window.document.querySelector('.active-input-label')?.textContent).toBe(`Label ${literal}`);
});

it('keeps escaped braces literal and renders markup-looking source only as text', () => {
  const label = String.raw`<img src=x onerror=alert(1)> \{{test}} **plain** {{base}}`;
  const result = renderActive(calc + `::edit[${label}]{input=test}`);
  expect(result.messages).toEqual([]);
  const doc = new JSDOM(result.html).window.document;
  expect(doc.querySelector('.active-input-label')?.textContent).toBe('<img src=x onerror=alert(1)> {{test}} **plain** 100');
  expect(doc.querySelector('img, strong')).toBeNull();
});

it('limits interpolation work per document', () => {
  const result = renderActive(calc + Array.from({ length: 257 }, () => '::edit[{{base}}]{input=test}').join('\n\n'));
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0]?.message).toContain('256 label expressions');
});

it('reports option-expression errors at the option and preserves option-value validation', () => {
  const invalidLabel = renderActive(calc + ':::radio[Plan]{input=plan}\n::option[{{test}}]{value=base}\n:::');
  expect(invalidLabel.messages[0]).toMatchObject({ line: 10, column: 1, message: expect.stringContaining('depends on a Calc input') });
  const invalidValue = renderActive(calc + ':::radio[Plan]{input=plan}\n::option[{{value}}]{value=value}\n:::');
  expect(invalidValue.messages[0]?.message).toContain('outside the calc input range');
  expect(invalidValue.html).not.toContain('<fieldset');
});
