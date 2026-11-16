import { expect, it } from 'vitest';
import katex from 'katex';
import { renderActive, substitute } from '../src/index.js';

const values = (...numbers: number[]) => numbers.map(value => ({ kind: 'value' as const, value }));

it('uses visible parentheses for negative power bases but leaves positive bases unchanged', () => {
  expect(substitute('{{x}}^2', values(-3))).toBe('{\\left(-3\\right)}^2');
  expect(substitute('{{x}} ^ {2}', values(3))).toBe('{3} ^ {2}');
  expect(substitute('x^{{n}}', values(-3))).toBe('x^{-3}');
});

it.each(['\\cdot', '\\times', '\\div', '+', '-', '*', '/'])('groups negative operands after binary %s', operator => {
  expect(substitute(`a ${operator} {{x}}`, values(-2))).toBe(`a ${operator} {\\left(-2\\right)}`);
  expect(substitute(`a ${operator} {{x}}`, values(2))).toBe(`a ${operator} {2}`);
});

it('leaves equality, unary signs, TeX arguments and authored parentheses alone', () => {
  expect(substitute('= {{x}}', values(-3))).toBe('= {-3}');
  expect(substitute('-{{x}}', values(-3))).toBe('-{-3}');
  expect(substitute('({{x}})^2', values(-3))).toBe('({-3})^2');
  expect(substitute('\\left({{x}}\\right)^2', values(-3))).toBe('\\left({-3}\\right)^2');
  expect(substitute('\\sqrt{{x}}', values(4))).toBe('\\sqrt{4}');
});

it('groups scientific/locale-formatted compound numbers only where context requires it', () => {
  expect(substitute('{{x}}^2', values(1e24))).toBe('{\\left(1\\times 10^{24}\\right)}^2');
  expect(substitute('= {{x}}', values(1e24))).toBe('= {1\\times 10^{24}}');
  expect(substitute('{{x | fixed:2}}^2', values(-3), 'en-US')).toBe('{\\left(-3.00\\right)}^2');
  expect(substitute('2 * {{x | fixed:2}}', values(1234), 'ru-RU')).toBe('2 * {\\left(1\\,234{,}00\\right)}');
});

it('keeps text and verbatim placeholders valid, then resumes math context after the label', () => {
  const tex = '\\text{Cost - {{x}} and {nested + {{x}}}} + {{x}}';
  const result = substitute(tex, values(-3, -3, -3));
  expect(result).toBe('\\text{Cost - {-3} and {nested + {-3}}} + {\\left(-3\\right)}');
  expect(() => katex.renderToString(result, { throwOnError: true })).not.toThrow();
  expect(substitute('\\verb|label - {{x}}| + {{x}}', values(-3, -3)))
    .toBe('\\verb|label - {-3}| + {\\left(-3\\right)}');
});

it('renders products and powers with correct visible grouping through the sanitized pipeline', () => {
  const source = '```calc\ninput x = -3\n```\n\n${{x}} \\cdot {{x}}^2$';
  const result = renderActive(source);
  expect(result.messages).toEqual([]);
  expect(result.html).toContain('\\left(-3\\right)');
  expect(result.html).not.toContain('katex-error');
});

it.each(['\\fbox', '\\colorbox{red}', '\\fcolorbox{red}{blue}', '\\raisebox{1pt}', '\\reflectbox', '\\angl'])('preserves boxed text arguments of %s and resumes math afterward', command => {
  const tex = `${command}{Cost - {{x}} and {nested + {{x}}}} + {{x}}^2`;
  const result = substitute(tex, values(-3, -3, -3));
  expect(result).toBe(`${command}{Cost - {-3} and {nested + {-3}}} + {\\left(-3\\right)}^2`);
  expect(() => katex.renderToString(result, { throwOnError: true })).not.toThrow();
  const rendered = renderActive('```calc\nx = -3\n```\n\n$' + tex + '$');
  expect(rendered.messages).toEqual([]);
  expect(rendered.html).not.toContain('katex-error');
});

it('keeps nested boxed labels in text mode without suppressing later math grouping', () => {
  const tex = '\\colorbox{red}{Outer \\fcolorbox{blue}{white}{Inner - {{x}}}} + \\boxed{2 - {{x}}}';
  const result = substitute(tex, values(-3, -3));
  expect(result).toBe('\\colorbox{red}{Outer \\fcolorbox{blue}{white}{Inner - {-3}}} + \\boxed{2 - {\\left(-3\\right)}}');
  expect(() => katex.renderToString(result, { throwOnError: true })).not.toThrow();
});
