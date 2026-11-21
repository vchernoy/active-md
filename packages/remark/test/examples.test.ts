import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { renderActive } from '../src/index.js';

const dir = fileURLToPath(new URL('../../../examples/', import.meta.url));
const examples = readdirSync(dir).filter(name => name.endsWith('.md') && name !== 'README.md').sort();

describe('examples/', () => {
  it('has the documented examples', () => {
    const index = readFileSync(dir + 'README.md', 'utf8');
    expect(examples.length).toBeGreaterThan(0);
    for (const name of examples) expect(index).toContain(`(${name})`);
  });

  it.each(examples)('%s renders without problems', name => {
    const { html, program, messages } = renderActive(readFileSync(dir + name, 'utf8'), { locale: 'en-US' });
    expect(messages).toEqual([]);
    expect(program).toBeDefined();
    expect(html).not.toContain('active-error');
    // KaTeX renders with throwOnError: false, so malformed TeX shows up as markup, not a message.
    expect(html).not.toContain('katex-error');
    // A failed {{…}} in math becomes a red "?".
    expect(html).not.toMatch(/mathcolor="red"|color:\s*red/);
    // Every :input and :value is bound to the program.
    expect(html).toContain('data-active-input=');
    expect(html).toContain('data-active-value=');
  });
});

it.each([0, -4, 4])('powers and roots stays valid at base %s', x => {
  const markdown = readFileSync(dir + 'powers-and-roots.md', 'utf8').replace('input x = 2', `input x = ${x}`);
  const rendered = renderActive(markdown, { locale: 'en-US' });
  expect(rendered.messages).toEqual([]);
  if (x < 0) expect(rendered.html).toContain(`\\left({${x}}\\right)^0`);
  expect(rendered.html).not.toContain('active-error');
  expect(rendered.html).not.toContain('katex-error');
  expect(rendered.html).not.toContain('mathcolor="red"');
});

it.each([0, 30])('compound interest handles doubling-time rate %s without domain errors', rate => {
  const source = readFileSync(dir + 'compound-interest.md', 'utf8').replace('input rate = 8', `input rate = ${rate}`);
  const rendered = renderActive(source, { locale: 'en-US' });
  expect(rendered.messages).toEqual([]);
  expect(rendered.html).not.toContain('active-error');
  expect(rendered.html).not.toContain('katex-error');
});

const unlimitedNeverCostsMore = 'Unlimited never costs more than Basic at these prices.';
const basicNeverCostsMore = 'Extra data is free, so Basic never costs more than Unlimited at these prices.';

it.each([
  [0, 5, unlimitedNeverCostsMore],
  [0, 10, unlimitedNeverCostsMore],
  [0, 25, basicNeverCostsMore],
  [3, 5, unlimitedNeverCostsMore],
  [3, 10, unlimitedNeverCostsMore],
  [3, 25, 'Above about 10.0 GB a month, Unlimited costs less.'],
])('phone plans explain the break-even for extra price %s and Unlimited fee %s', (extraPrice, unlimitedFee, explanation) => {
  const source = readFileSync(dir + 'compare-plans.md', 'utf8')
    .replace('input extraPrice = 3', `input extraPrice = ${extraPrice}`)
    .replace('input unlimitedFee = 25', `input unlimitedFee = ${unlimitedFee}`);
  const { html, messages } = renderActive(source, { locale: 'en-US' });
  expect(messages).toEqual([]);
  const { document } = new JSDOM(html).window;
  const visibleExplanations = [...document.querySelectorAll('details p')]
    .filter(paragraph => !paragraph.closest('[hidden]'))
    .map(paragraph => paragraph.textContent?.trim())
    .filter(text => text && /^(Above about|Unlimited never|Extra data is free)/.test(text));
  expect(visibleExplanations).toEqual([explanation]);
});
