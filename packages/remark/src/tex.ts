import type { Result } from '@vchernoy/calc';

/** `{{expr}}` inside TeX. An expression ends at the first "}}". */
export const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

/** The expressions used in a TeX template, in order. */
export function placeholders(tex: string): string[] {
  return [...tex.matchAll(PLACEHOLDER)].map(m => m[1]!.trim());
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
export function substitute(tex: string, results: readonly Result[]): string {
  let i = 0;
  return tex.replace(PLACEHOLDER, () => {
    const r = results[i++];
    return r?.kind === 'value' ? `{${texNumber(r.value)}}` : '{\\color{red}?}';
  });
}
