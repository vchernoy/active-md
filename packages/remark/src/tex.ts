import { formatNumber, type Format, type Result } from '@vchernoy/calc';
import type { KatexOptions as KatexSettings } from 'katex';
import { numericBinding } from './numeric-binding.js';

export { numericBinding as mathBinding, type NumericBinding as MathBinding } from './numeric-binding.js';

/** `{{expr}}` inside TeX. An expression ends at the first "}}". */
export const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

/** The calc expressions used in a TeX template, without optional format specs. */
export function placeholders(tex: string): string[] {
  return [...tex.matchAll(PLACEHOLDER)].map(m => numericBinding(m[1]!).expression);
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
  // Track text-mode arguments in one forward pass; inserting \left into \text
  // would turn an otherwise valid numeric label into a KaTeX error.
  const textCommands = new Set(['text', 'textrm', 'textsf', 'texttt', 'textnormal', 'textbf', 'textit', 'textup', 'emph', 'textmd', 'textsc', 'mbox', 'hbox', 'operatorname']);
  // Box commands have typed arguments before their text body. Preserve their
  // remaining arguments across closing braces, including nested label groups.
  const argumentCounts = new Map([...textCommands].map(name => [name, 1]));
  for (const name of ['fbox', 'reflectbox', 'angl']) argumentCounts.set(name, 1);
  for (const name of ['colorbox', 'raisebox']) argumentCounts.set(name, 2);
  argumentCounts.set('fcolorbox', 3);
  const modes: { text: boolean; remaining: boolean[] }[] = [{ text: false, remaining: [] }];
  let pendingArguments: boolean[] = [];
  let cursor = 0, literalUntil = 0;
  const inText = (offset: number): boolean => {
    while (cursor < offset) {
      const char = tex[cursor++]!;
      if (char === '\\') {
        const command = /^[A-Za-z]+|^[\s\S]/.exec(tex.slice(cursor))?.[0] ?? '';
        cursor += command.length;
        if (command === 'verb') {
          if (tex[cursor] === '*') cursor++;
          const delimiter = tex[cursor++] ?? '';
          const end = delimiter ? tex.indexOf(delimiter, cursor) : -1;
          literalUntil = end < 0 ? tex.length : end + 1;
          cursor = literalUntil;
        }
        pendingArguments = Array<boolean>(argumentCounts.get(command) ?? 0).fill(true);
      } else if (char === '%') {
        const end = tex.indexOf('\n', cursor);
        literalUntil = end < 0 ? tex.length : end;
        cursor = literalUntil;
      } else if (char === '{') {
        const [textArgument, ...remaining] = pendingArguments;
        modes.push({ text: modes[modes.length - 1]!.text || textArgument === true, remaining });
        pendingArguments = [];
      } else if (char === '}') {
        pendingArguments = modes.length > 1 ? modes.pop()!.remaining : [];
      } else if (!/\s/.test(char)) pendingArguments.shift();
    }
    return offset < literalUntil || modes[modes.length - 1]!.text || pendingArguments[0] === true;
  };
  return tex.replace(PLACEHOLDER, (match, source: string, offset: number) => {
    const textMode = inText(offset);
    cursor = Math.max(cursor, offset + match.length); pendingArguments.shift();
    const r = results[i++];
    const binding = numericBinding(source);
    if (binding.problem || r?.kind !== 'value') return '{\\color{red}?}';
    const number = binding.format ? formattedTexNumber(r.value, binding.format, locale) : texNumber(r.value);
    const compound = r.value < 0 || !/^\d+(?:\.\d+)?$/.test(number);
    const power = /^\s*\^/.test(tex.slice(offset + match.length));
    let end = offset;
    while (end > 0 && /\s/.test(tex[end - 1]!)) end--;
    // Only bounded suffixes are needed; avoid rescanning a long template per placeholder.
    const operator = /(\\(?:cdot|times|div)|[+\-*/])$/.exec(tex.slice(Math.max(0, end - 6), end));
    let leftEnd = operator ? end - operator[0].length : 0;
    while (leftEnd > 0 && /\s/.test(tex[leftEnd - 1]!)) leftEnd--;
    const left = tex.slice(Math.max(0, leftEnd - 6), leftEnd);
    // A sign after another operator/opening delimiter is unary, not binary.
    const binary = !!operator && !!left && !/[=+\-*/^_([{,:]$/.test(left) && !/\\(?:cdot|times|div)\s*$/.test(left);
    // Unknown built-in/user macros may enter text mode only during expansion.
    // Let KaTeX choose at parse time: math gets visible parentheses, text gets
    // the unchanged number. Known text/verbatim contexts keep their old bytes.
    return `{${!textMode && compound && (power || binary)
      ? `\\TextOrMath{${number}}{\\left(${number}\\right)}` : number}}`;
  });
}

/** "mathml" (default) needs no CSS or fonts; "htmlAndMathml" needs the host to load KaTeX's CSS. */
export type MathOutput = 'mathml' | 'htmlAndMathml';

/** KaTeX options that are always safe for untrusted documents. */
export function katexSettings(displayMode: boolean, output: MathOutput = 'mathml'): KatexSettings {
  return { displayMode, output, throwOnError: false, trust: false, strict: 'ignore', maxSize: 50, maxExpand: 1000 };
}
