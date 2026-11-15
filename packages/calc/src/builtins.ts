/** Built-in functions of v0. All are pure and total over finite numbers, or report an error. */
export type Builtin = { min: number; max: number; fn: (args: number[]) => number | string };

const check = (x: number): number | string => Number.isFinite(x) ? x : 'result is not a finite number';

const REGISTRY: Record<string, Builtin> = {
  even: { min: 1, max: 1, fn: ([x]) => Number(Math.abs(Math.round(x!)) % 2 === 0) },
  odd: { min: 1, max: 1, fn: ([x]) => Number(Math.abs(Math.round(x!)) % 2 === 1) },
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

/** Built-ins by name, with no inherited properties ("toString", "constructor" are not built-ins). */
export const BUILTINS: Readonly<Record<string, Builtin>> = Object.freeze(Object.assign(Object.create(null) as Record<string, Builtin>, REGISTRY));

/** Look up a built-in by its own name only. */
export function builtin(name: string): Builtin | undefined {
  return Object.hasOwn(BUILTINS, name) ? BUILTINS[name] : undefined;
}

export const RESERVED = new Set(['input', 'in', 'if', 'and', 'or', 'not']);
