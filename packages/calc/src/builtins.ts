/** Built-in functions of v0. All are pure and total over finite numbers, or report an error. */
export type Builtin = { min: number; max: number; fn: (args: number[]) => number | string };

const check = (x: number): number | string => Number.isFinite(x) ? x : 'result is not a finite number';

const REGISTRY: Record<string, Builtin> = {
  ln: { min: 1, max: 1, fn: ([x]) => x! <= 0 ? 'ln: argument must be positive' : Math.log(x!) },
  log: { min: 1, max: 2, fn: ([x, base]) => {
    if (x! <= 0) return 'log: argument must be positive';
    if (base !== undefined && (base <= 0 || base === 1)) return 'log: base must be positive and different from 1';
    return base === undefined ? Math.log10(x!) : check(Math.log(x!) / Math.log(base));
  } },
  exp: { min: 1, max: 1, fn: ([x]) => check(Math.exp(x!)) },
  sin: { min: 1, max: 1, fn: ([x]) => Math.sin(x!) },
  cos: { min: 1, max: 1, fn: ([x]) => Math.cos(x!) },
  tan: { min: 1, max: 1, fn: ([x]) => check(Math.tan(x!)) },
  asin: { min: 1, max: 1, fn: ([x]) => Math.abs(x!) > 1 ? 'asin: argument must be between -1 and 1' : Math.asin(x!) },
  acos: { min: 1, max: 1, fn: ([x]) => Math.abs(x!) > 1 ? 'acos: argument must be between -1 and 1' : Math.acos(x!) },
  atan: { min: 1, max: 1, fn: ([x]) => Math.atan(x!) },
  atan2: { min: 2, max: 2, fn: ([y, x]) => Math.atan2(y!, x!) },
  deg: { min: 1, max: 1, fn: ([x]) => check(x! * (180 / Math.PI)) },
  rad: { min: 1, max: 1, fn: ([x]) => x! * (Math.PI / 180) },
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

/** Constants are fallback names; ordinary document definitions take precedence. */
export function constant(name: string): number | undefined {
  return name === 'pi' ? Math.PI : name === 'e' ? Math.E : undefined;
}
