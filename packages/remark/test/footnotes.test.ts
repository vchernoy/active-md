import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';

it('links every GFM footnote reference and backlink to its sanitized target', () => {
  const { html } = renderActive('First[^é], again[^é], and another[^two].\n\n[^é]: A note.\n[^two]: Another note.');
  const { document } = new JSDOM(html).window;
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[data-footnote-ref], a[data-footnote-backref]')];
  expect(links).toHaveLength(6);
  for (const link of links) {
    const id = link.getAttribute('href')!.slice(1);
    expect(id).toMatch(/^user-content-/);
    const target = document.getElementById(id);
    expect(target?.tagName).toBe(link.hasAttribute('data-footnote-ref') ? 'LI' : 'A');
  }
});

it('preserves ordinary fragment links and drops raw HTML IDs and names', () => {
  const { html } = renderActive('[Jump](#later)\n\n<a id="later" name="location">Raw HTML</a>');
  const { document } = new JSDOM(html).window;
  expect(document.querySelector('a')?.getAttribute('href')).toBe('#later');
  expect(document.querySelector('[id="later"], [name="location"]')).toBeNull();
});
