import type { Result } from '@vchernoy/calc';
import type { KatexOptions as KatexSettings } from 'katex';

/** `{{expr}}` inside TeX. An expression ends at the first "}}". */
export const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

/** The expressions used in a TeX template, in order. */
export function placeholders(tex: string): string[] {
  return [...tex.matchAll(PLACEHOLDER)].map(m => m[1]!.trim());
}

/** A number as TeX: no grouping, "." as decimal point, at most 6 decimals, negatives braced. */
export function texNumber(value: number): string {
  const s = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  if (/e/i.test(s)) {
    const [m, e] = s.split(/e/i);
    return `{${m}\\times 10^{${Number(e)}}}`;
  }
  return value < 0 ? `{${s}}` : s;
}

/** Substitute results into a template. Errors show as a red "?", the message stays out of TeX. */
export function substitute(tex: string, results: readonly Result[]): string {
  let i = 0;
  return tex.replace(PLACEHOLDER, () => {
    const r = results[i++];
    return r?.kind === 'value' ? texNumber(r.value) : '{\\color{red}?}';
  });
}

/** "mathml" (default) needs no CSS or fonts; "htmlAndMathml" needs the host to load KaTeX's CSS. */
export type MathOutput = 'mathml' | 'htmlAndMathml';

/** KaTeX options that are always safe for untrusted documents. */
export function katexSettings(displayMode: boolean, output: MathOutput = 'mathml'): KatexSettings {
  return { displayMode, output, throwOnError: false, trust: false, strict: 'ignore', maxSize: 50, maxExpand: 1000 };
}
