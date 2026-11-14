import { describe, expect, it, vi } from 'vitest';
import * as calc from '@vchernoy/calc';
import { renderActive, substitute, placeholders, mathBinding } from '../src/index.js';
import katex from 'katex';

const value = (n: number) => [{ kind: 'value' as const, value: n }];
const doc = (binding: string) => '```calc\nfinal = 43178.5\n```\n\n$' + binding + '$';
describe('formatted math placeholders', () => {
  it('keeps unformatted substitution byte-identical and separates optional specs', () => {
    expect(substitute('{{final}}', value(43178.5), 'ru-RU')).toBe('{43178.5}');
    expect(substitute('{{final | fixed:2}}', value(43178.5), 'en-US')).toBe('{43{,}178.50}');
    expect(substitute('{{final | fixed:2}}', value(43178.5), 'ru-RU')).toBe('{43\\,178{,}50}');
    expect(placeholders('{{final | fixed:2}} + {{round(final, 2)}}')).toEqual(['final', 'round(final, 2)']);
  });
  it.each(['auto', 'int', 'fixed:0', 'fixed:2', 'percent:1'])('accepts the same %s format as value bindings', spec => {
    const result = substitute(`{{final | ${spec}}}`, value(43178.5), 'en-US');
    expect(() => katex.renderToString(result, { throwOnError: true })).not.toThrow();
    expect(result).not.toContain('color{red}');
  });
  it('escapes percent and locale decimal commas as TeX', () => {
    expect(substitute('{{x | percent:1}}', value(0.085), 'en-US')).toBe('{8.5\\%}');
    expect(substitute('{{x | percent:1}}', value(0.085), 'ru-RU')).toBe('{8{,}5\\,\\%}');
  });
  it('escapes every TeX special character from formatted text', () => {
    const spy = vi.spyOn(calc, 'formatNumber').mockReturnValue('1\\{}$&#_^~%,');
    try {
      const result = substitute('{{x | int}}', value(1), 'en-US');
      expect(result).toBe('{1\\backslash{}\\{\\}\\$\\&\\#\\_\\text{\\textasciicircum}\\text{\\textasciitilde}\\%{,}}');
      expect(() => katex.renderToString(result, { throwOnError: true })).not.toThrow();
    } finally { spy.mockRestore(); }
  });
  it.each(['final | bogus', 'final | fixed:99', 'final |', '| int', 'final | int | fixed:2', 'final || int', 'round(final | 2)'])('rejects malformed format/expression boundaries: %s', source => {
    const result = renderActive(doc(`{{${source}}}`), { locale: 'en-US' });
    expect(result.html).toContain('?');
    expect(result.html).toContain('mathcolor="red"');
    expect(result.messages).toEqual(expect.arrayContaining([expect.objectContaining({ severity: 'error', line: 5, column: 1 })]));
    expect(mathBinding(source).problem || result.messages.length).toBeTruthy();
  });
  it('reports a bad expression even when its format is valid', () => {
    const result = renderActive(doc('{{missing | fixed:2}}'));
    expect(result.messages[0]).toMatchObject({ severity: 'error', line: 5, column: 1 });
    expect(result.html).toContain('mathcolor="red"');
  });
  it('server MathML uses the safely formatted TeX', () => {
    const result = renderActive(doc('{{final | fixed:2}}'), { locale: 'en-US' });
    expect(result.messages).toEqual([]);
    expect(result.html).toContain('{43{,}178.50}');
  });
});
