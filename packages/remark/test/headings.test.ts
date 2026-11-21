import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';

function document(source: string) {
  const result = renderActive(source);
  expect(result.messages).toEqual([]);
  return new JSDOM(result.html).window.document;
}

it('matches local links to deterministic, unique GitHub-style heading IDs', () => {
  const source = '[First](#hello-world) [Second](#hello-world-1) [Third](#hello-world-2)\n\n# Hello *world*!\n\n## Hello `world`\n\n### Hello world\n\n#### Hello world-1';
  const doc = document(source);
  expect([...doc.querySelectorAll('h1,h2,h3,h4')].map(h => h.id)).toEqual([
    'user-content-hello-world', 'user-content-hello-world-1', 'user-content-hello-world-2', 'user-content-hello-world-1-1',
  ]);
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('a')) expect(doc.getElementById(a.hash.slice(1))).not.toBeNull();
  expect(document(source).body.innerHTML).toBe(doc.body.innerHTML);
});

it('supports Unicode and encoded fragments while preserving unknown/external links', () => {
  const doc = document('[Unicode](#%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82-%E4%B8%96%E7%95%8C) [Unknown](#unknown) [Bad](#%zz) [Other](https://example.com/#hello)\n\n## Привет 世界');
  const links = [...doc.querySelectorAll<HTMLAnchorElement>('a')];
  expect(links.map(a => a.getAttribute('href'))).toEqual([
    '#user-content-привет-世界', '#unknown', '#%zz', 'https://example.com/#hello',
  ]);
  expect(doc.getElementById(links[0]!.getAttribute('href')!.slice(1))?.textContent).toBe('Привет 世界');
});

it('reserves existing footnote IDs and keeps all footnote navigation intact', () => {
  const doc = document('[Heading](#footnote-label-1)\n\n## Footnote label\n\n## footnote-label\n\nNote[^a].\n\n[^a]: Footnote.');
  const ids = [...doc.querySelectorAll('[id]')].map(n => n.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(doc.getElementById('user-content-footnote-label-1')?.tagName).toBe('H2');
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    expect(doc.getElementById(a.getAttribute('href')!.slice(1))).not.toBeNull();
  }
});

it('gives empty slugs safe fallbacks without creating DOM clobbering targets', () => {
  const doc = document('[Location](#location)\n\n# location\n\n## !!!\n\n## ???\n\n<a id="location" name="document">Raw</a>');
  expect([...doc.querySelectorAll('h1,h2')].map(h => h.id)).toEqual([
    'user-content-location', 'user-content-section', 'user-content-section-1',
  ]);
  expect(doc.getElementById('location')).toBeNull();
  expect(doc.querySelector('[name="document"],script,[onclick]')).toBeNull();
  expect(doc.querySelector('a')?.getAttribute('href')).toBe('#user-content-location');
});
