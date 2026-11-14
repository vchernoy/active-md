import { formatNumber, parseFormat, type Format, type Result } from '@vchernoy/calc';
import type { KatexOptions as KatexSettings } from 'katex';

/** `{{expr}}` inside TeX. An expression ends at the first "}}". */
export const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

export type MathBinding = { expression: string; format?: Format; problem?: string };

/** A single optional format separator; pipes are not calc operators. */
export function mathBinding(source: string): MathBinding {
  const parts = source.split('|');
  const expression = parts[0]!.trim();
  if (parts.length === 1) return { expression };
  if (parts.length !== 2) return { expression, problem: 'use one | format separator' };
  const spec = parts[1]!.trim();
  if (!expression || !spec) return { expression, problem: 'expected expression | format' };
  const format = parseFormat(spec);
  return typeof format === 'string' ? { expression, problem: format } : { expression, format };
}

/** The calc expressions used in a TeX template, without optional format specs. */
export function placeholders(tex: string): string[] {
  return [...tex.matchAll(PLACEHOLDER)].map(m => mathBinding(m[1]!).expression);
}

/** Escape locale-formatted numeric text before it crosses the TeX boundary. */
export function formattedTexNumber(value: number, format: Format, locale?: string): string {
  const escapes: Record<string, string> = {
    ',': '{,}', '%': '\\%', '\\': '\\backslash{}', '{': '\\{', '}': '\\}',
    '$': '\\$', '&': '\\&', '#': '\\#', '_': '\\_', '^': '\\text{\\textasciicircum}', '~': '\\text{\\textasciitilde}',
  };
  return [...formatNumber(value, format, locale)].map(char => {
    if (/^[0-9.+-]$/.test(char)) return char;
    if (/\s/u.test(char)) return '\\,';
    return escapes[char] ?? `\\text{${char}}`;
  }).join('');
}

/** A number as TeX: no grouping, "." as decimal point, at most 6 decimals. */
export function texNumber(value: number): string {
  const s = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  if (/e/i.test(s)) {
    const [m, e] = s.split(/e/i);
    return `${m}\\times 10^{${Number(e)}}`;
  }
  return s;
}

/**
 * Substitute results into a template. Every value is one TeX group, so `x^{{n}}` and `\\sqrt{{n}}`
 * keep the whole number as the argument. Errors show as a red "?"; the message stays out of TeX.
 */
export function substitute(tex: string, results: readonly Result[], locale?: string): string {
  let i = 0;
  return tex.replace(PLACEHOLDER, (_match, source: string) => {
    const r = results[i++];
    const binding = mathBinding(source);
    if (binding.problem || r?.kind !== 'value') return '{\\color{red}?}';
    return `{${binding.format ? formattedTexNumber(r.value, binding.format, locale) : texNumber(r.value)}}`;
  });
}

/** "mathml" (default) needs no CSS or fonts; "htmlAndMathml" needs the host to load KaTeX's CSS. */
export type MathOutput = 'mathml' | 'htmlAndMathml';

/** KaTeX options that are always safe for untrusted documents. */
export function katexSettings(displayMode: boolean, output: MathOutput = 'mathml'): KatexSettings {
  return { displayMode, output, throwOnError: false, trust: false, strict: 'ignore', maxSize: 50, maxExpand: 1000 };
}
