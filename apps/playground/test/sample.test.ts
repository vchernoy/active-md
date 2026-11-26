import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { SAMPLE } from '../src/sample';

it('renders current-syntax sample controls with accessible names and authored visible prose', () => {
  const rendered = renderActive(SAMPLE, { locale: 'en-US' });
  expect(rendered.messages).toEqual([]);
  const dom = new JSDOM(rendered.html);
  const { document } = dom.window;
  for (const [name, text] of [['principal', 'Deposit (starts at 10,000.00)'], ['rate', 'Rate (%/year)'], ['years', 'Term (years)']]) {
    const input = document.querySelector<HTMLInputElement>(`input[data-active-input="${name}"]`)!;
    expect(input.getAttribute('aria-label')).toBe(text);
    expect(input.closest('p')?.textContent).toContain('Deposit');
    expect(input.closest('p')?.textContent).toContain('% per year');
    expect(input.closest('p')?.textContent).toContain('years.');
  }
  expect(document.querySelector('output[data-active-value="rate"]')?.textContent).toBe('8');
  expect(document.querySelector('select')?.value).toBe('5200');
  expect(document.querySelector<HTMLInputElement>('input[type=radio]:checked')?.value).toBe('0');
  dom.window.close();
});
