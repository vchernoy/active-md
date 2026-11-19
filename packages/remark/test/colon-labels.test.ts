import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderActive } from '../src/index.js';

// Markdown reads ":1" in "3:1" as a text directive named "1"; labels must keep it as text (#100).
const calc = '```calc\ninput r = 3 in 0..10\n```\n\n';
const doc = (source: string) => {
  const result = renderActive(calc + source);
  expect(result.messages).toEqual([]);
  return new JSDOM(result.html).window.document;
};

it.each(['radio', 'select'])('keeps ratio and time-like text in %s titles and option labels', kind => {
  const d = doc(`:::${kind}[Aspect 16:10 or 3:1]{input=r}\n::option[Assume 3:1 DSC]{value=3}\n::option[16:10 at 10:30]{value=2}\n::option[Escaped 4\\:3]{value=1}\n::option[**Bold** 21:9]{value=0}\n:::\n`);
  const labels = kind === 'radio'
    ? [...d.querySelectorAll('fieldset label')].map(label => label.textContent)
    : [...d.querySelectorAll('option')].map(option => option.textContent);
  expect(labels).toEqual(['Assume 3:1 DSC', '16:10 at 10:30', 'Escaped 4:3', 'Bold 21:9']);
  expect(kind === 'radio' ? d.querySelector('legend')?.textContent : d.querySelector('select')?.getAttribute('aria-label')).toBe('Aspect 16:10 or 3:1');
  expect(d.querySelector('strong,img')).toBeNull();
});

it.each([':edit', ':slider', '::edit'])('keeps colon-number text in the accessible name of %s', directive => {
  const d = doc(`${directive}[Ratio 3:1 by 16:10]{input=r}`);
  expect(d.querySelector('[data-active-input="r"][aria-label]')?.getAttribute('aria-label')).toBe('Ratio 3:1 by 16:10');
});

it('keeps a literal unknown directive in a label as source, without making markup', () => {
  const d = doc(':::radio[Pick]{input=r}\n::option[See :foo[bar] now]{value=3}\n::option[Other]{value=1}\n:::\n');
  expect(d.querySelector('fieldset label')?.textContent).toBe('See :foo[bar] now');
  expect(d.querySelector('fieldset label *:not(input)')).toBeNull();
});
