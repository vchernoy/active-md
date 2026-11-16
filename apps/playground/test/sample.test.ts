import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { SAMPLE } from '../src/sample';

it('renders named compound-interest controls with their units and slider readout inside the associated label', () => {
  const rendered = renderActive(SAMPLE);
  expect(rendered.messages).toEqual([]);
  const { document } = new JSDOM(rendered.html).window;
  for (const [name, text] of [['principal', 'Deposit'], ['rate', 'Rate (%/year)'], ['years', 'Term (years)']]) {
    const input = document.querySelector<HTMLInputElement>(`input[data-active-input="${name}"]`)!;
    expect(input.labels).toHaveLength(1);
    expect(input.labels![0]!.querySelector('.active-input-label')?.textContent).toBe(text);
    expect(input.hasAttribute('aria-label')).toBe(false); // The visible label supplies the name.
  }
  const rate = document.querySelector<HTMLInputElement>('input[data-active-input="rate"]')!;
  expect(rate.labels![0]!.querySelector('output[data-active-value="rate"]')?.textContent).toBe(rate.value);
});
