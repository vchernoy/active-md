/**
 * Number formatting and parsing for bindings.
 * Formats: "auto" (default; up to 6 significant decimals), "fixed:N", "percent:N" (0.08 → 8%), "int".
 */
export type Format = { kind: 'auto' } | { kind: 'fixed'; digits: number } | { kind: 'percent'; digits: number } | { kind: 'int' };

export function parseFormat(spec: string | undefined): Format | string {
  if (!spec || spec === 'auto') return { kind: 'auto' };
  if (spec === 'int') return { kind: 'int' };
  const m = /^(fixed|percent):(\d{1,2})$/.exec(spec);
  if (m && Number(m[2]) <= 15) return { kind: m[1] as 'fixed' | 'percent', digits: Number(m[2]) };
  return `unknown format "${spec}" (use auto, int, fixed:N or percent:N)`;
}

export function formatNumber(value: number, format: Format = { kind: 'auto' }, locale?: string): string {
  const opts: Intl.NumberFormatOptions =
    format.kind === 'fixed' ? { minimumFractionDigits: format.digits, maximumFractionDigits: format.digits }
    : format.kind === 'percent' ? { style: 'percent', minimumFractionDigits: format.digits, maximumFractionDigits: format.digits }
    : format.kind === 'int' ? { maximumFractionDigits: 0 }
    : { maximumFractionDigits: 6 };
  const s = new Intl.NumberFormat(locale, opts).format(value);
  // Avoid "-0" after rounding.
  return /^-0([.,]0*)?%?$/.test(s) ? s.slice(1) : s;
}

/**
 * Parse a number typed by a reader. Accepts the locale's decimal separator and also ".",
 * group separators (spaces, the locale's group character, "_"), a leading "+" or "-" and the Unicode minus.
 * Returns undefined if the text is not a number.
 */
export function parseUserNumber(text: string, locale?: string): number | undefined {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find(p => p.type === 'group')?.value ?? ',';
  const decimal = parts.find(p => p.type === 'decimal')?.value ?? '.';
  let s = text.trim().replace(/\u2212/g, '-').replace(/[\s\u00a0\u202f_]/g, '');
  // A decimal comma is accepted only where the locale uses one; "." is always a decimal point
  // unless the text also has the locale's decimal comma (then "." groups digits, as in 1.234,5).
  const groupChar = decimal === ',' ? (s.includes(',') ? '.' : '') : group === '.' ? '' : group;
  if (groupChar) {
    const [int = '', ...rest] = s.split(decimal === ',' ? ',' : '.');
    if (int.includes(groupChar)) {
      // Groups must be three digits: reject "1,5" read as fifteen.
      if (!new RegExp(`^[+-]?\\d{1,3}(\\${groupChar}\\d{3})+$`).test(int)) return undefined;
      s = [int.split(groupChar).join(''), ...rest].join(decimal === ',' ? ',' : '.');
    }
  }
  if (decimal === ',') s = s.replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
