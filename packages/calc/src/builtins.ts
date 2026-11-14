/** Built-in functions of v0. All are pure and total over finite numbers, or report an error. */
export type Builtin = { min: number; max: number; fn: (args: number[]) => number | string };

const check = (x: number): number | string => Number.isFinite(x) ? x : 'result is not a finite number';

export const BUILTINS: Readonly<Record<string, Builtin>> = {
  round: { min: 1, max: 2, fn: ([x, d = 0]) => {
    if (!Number.isInteger(d) || d! < 0 || d! > 15) return 'round: digits must be a whole number from 0 to 15';
    const f = 10 ** d!;
    return check(Math.round(x! * f) / f);
  } },
  floor: { min: 1, max: 1, fn: ([x]) => Math.floor(x!) },
  ceil: { min: 1, max: 1, fn: ([x]) => Math.ceil(x!) },
  abs: { min: 1, max: 1, fn: ([x]) => Math.abs(x!) },
  sqrt: { min: 1, max: 1, fn: ([x]) => x! < 0 ? 'sqrt of a negative number' : Math.sqrt(x!) },
  min: { min: 1, max: Infinity, fn: args => Math.min(...args) },
  max: { min: 1, max: Infinity, fn: args => Math.max(...args) },
};

export const RESERVED = new Set(['input', 'in']);
