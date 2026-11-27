import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ACTIVE_STYLES, activeStyle } from '../src/index.js';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('every listed style is known; unknown or corrupt values are plain', () => {
  expect(ACTIVE_STYLES.map(style => style.id)).toEqual(['plain', 'sketch', 'brutal', 'notebook', 'chalkboard']);
  for (const style of ACTIVE_STYLES) expect(activeStyle(style.id)).toBe(style.id);
  for (const value of [null, undefined, '', 'Sketch', 'brutal ', 'url(x)', 1, {}]) expect(activeStyle(value)).toBe('plain');
});

test('styles.css styles every listed style, requests nothing, and sketch.css stays an alias', () => {
  for (const style of ACTIVE_STYLES.filter(style => style.id !== 'plain')) expect(css).toContain(`[data-active-style="${style.id}"]`);
  expect(css).not.toMatch(/url\((?!"data:)/);
  expect(css).not.toMatch(/@import|@font-face/);
  expect(readFileSync(new URL('../sketch.css', import.meta.url), 'utf8')).toContain('@import "./styles.css";');
});
