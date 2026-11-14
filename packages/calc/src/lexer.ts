import type { Span } from './types.js';

export type Token =
  | { t: 'num'; value: number; span: Span }
  | { t: 'name'; value: string; span: Span }
  | { t: 'op'; value: string; span: Span }
  | { t: 'nl'; span: Span }
  | { t: 'bad'; message: string; span: Span }
  | { t: 'eof'; span: Span };

const NAME_START = /[A-Za-z_Ѐ-ӿ]/;
const NAME_PART = /[A-Za-z0-9_Ѐ-ӿ]/;
const OPS = ['..', '(', ')', ',', '=', '+', '-', '*', '/', '%', '^', '×', '÷'];

/** Tokenize one block. Newlines are significant (one definition per line) except inside parentheses. */
export function tokenize(block: string, text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0, line = 1, lineStart = 0, depth = 0;
  const span = (start: number, end: number): Span => ({ block, start, end, line, column: start - lineStart + 1 });
  while (i < text.length) {
    const c = text[i]!;
    if (c === '\n') {
      if (depth === 0) tokens.push({ t: 'nl', span: span(i, i + 1) });
      i++; line++; lineStart = i; continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(text[i + 1] ?? ''))) {
      const start = i;
      while (i < text.length && /[0-9_]/.test(text[i]!)) i++;
      if (text[i] === '.' && text[i + 1] !== '.') { i++; while (i < text.length && /[0-9_]/.test(text[i]!)) i++; }
      if ((text[i] === 'e' || text[i] === 'E') && /[0-9+-]/.test(text[i + 1] ?? '')) {
        i++; if (text[i] === '+' || text[i] === '-') i++;
        while (i < text.length && /[0-9]/.test(text[i]!)) i++;
      }
      const raw = text.slice(start, i);
      const value = Number(raw.replace(/_/g, ''));
      if (/_$|__|_\.|\._/.test(raw)) tokens.push({ t: 'bad', message: `badly placed "_" in number ${raw}`, span: span(start, i) });
      else if (!Number.isFinite(value)) tokens.push({ t: 'bad', message: `invalid number ${raw}`, span: span(start, i) });
      else tokens.push({ t: 'num', value, span: span(start, i) });
      continue;
    }
    if (NAME_START.test(c)) {
      const start = i;
      while (i < text.length && NAME_PART.test(text[i]!)) i++;
      tokens.push({ t: 'name', value: text.slice(start, i), span: span(start, i) });
      continue;
    }
    const op = OPS.find(o => text.startsWith(o, i));
    if (op) {
      if (op === '(') depth++;
      if (op === ')') depth = Math.max(0, depth - 1);
      const value = op === '×' ? '*' : op === '÷' ? '/' : op;
      tokens.push({ t: 'op', value, span: span(i, i + op.length) });
      i += op.length;
      continue;
    }
    tokens.push({ t: 'bad', message: `unexpected character "${c}"`, span: span(i, i + 1) });
    i++;
  }
  tokens.push({ t: 'eof', span: span(i, i) });
  return tokens;
}
