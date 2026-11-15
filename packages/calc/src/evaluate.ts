import { builtin } from './builtins.js';
import { DEFAULT_LIMITS, type Expr, type Limits, type Program, type Result } from './types.js';

class EvalError extends Error { constructor(readonly result: Extract<Result, { kind: 'error' }>) { super(result.message); } }

export type Lookup = (name: string) => Result | undefined;

/** A step budget shared by one evaluation pass. */
export class Budget {
  private used = 0;
  constructor(private readonly max: number) {}
  step(): void { if (++this.used > this.max) throw new EvalError({ kind: 'error', message: `the calculation took too many steps (limit ${this.max})` }); }
}

function finite(x: number, expr: Expr): number {
  if (!Number.isFinite(x)) throw new EvalError({ kind: 'error', message: 'result is not a finite number', span: expr.span });
  return x;
}

function evalExpr(expr: Expr, lookup: Lookup, budget: Budget): number {
  budget.step();
  switch (expr.kind) {
    case 'num': return expr.value;
    case 'ref': {
      const r = lookup(expr.name);
      if (!r) throw new EvalError({ kind: 'error', message: `unknown name "${expr.name}"`, span: expr.span });
      if (r.kind === 'error') throw new EvalError({ kind: 'error', message: `depends on an error in ${expr.name}`, span: expr.span });
      return r.value;
    }
    case 'neg': return -evalExpr(expr.arg, lookup, budget);
    case 'not': return Number(evalExpr(expr.arg, lookup, budget) === 0);
    case 'if': {
      for (let i = 0; i < expr.args.length - 1; i += 2) {
        if (evalExpr(expr.args[i]!, lookup, budget) !== 0) return evalExpr(expr.args[i + 1]!, lookup, budget);
      }
      return evalExpr(expr.args[expr.args.length - 1]!, lookup, budget);
    }
    case 'bin': {
      const left = evalExpr(expr.left, lookup, budget);
      if (expr.op === 'and') return left === 0 ? 0 : Number(evalExpr(expr.right, lookup, budget) !== 0);
      if (expr.op === 'or') return left !== 0 ? 1 : Number(evalExpr(expr.right, lookup, budget) !== 0);
      return binary(expr, left, evalExpr(expr.right, lookup, budget));
    }
    case 'call': {
      const b = builtin(expr.fn);
      if (!b) throw new EvalError({ kind: 'error', message: `unknown function "${expr.fn}"`, span: expr.span });
      const args = expr.args.map(a => evalExpr(a, lookup, budget));
      const r = b.fn(args);
      if (typeof r === 'string') throw new EvalError({ kind: 'error', message: r, span: expr.span });
      return finite(r, expr);
    }
  }
}

function binary(expr: Extract<Expr, { kind: 'bin' }>, a: number, b: number): number {
  switch (expr.op) {
    case '==': return Number(a === b);
    case '!=': return Number(a !== b);
    case '<': return Number(a < b);
    case '<=': return Number(a <= b);
    case '>': return Number(a > b);
    case '>=': return Number(a >= b);
    case 'and': return Number(a !== 0 && b !== 0);
    case 'or': return Number(a !== 0 || b !== 0);
    case '+': return finite(a + b, expr);
    case '-': return finite(a - b, expr);
    case '*': return finite(a * b, expr);
    case '/':
      if (b === 0) throw new EvalError({ kind: 'error', message: 'division by zero', span: expr.span });
      return finite(a / b, expr);
    case '%':
      if (b === 0) throw new EvalError({ kind: 'error', message: 'remainder of division by zero', span: expr.span });
      return finite(a % b, expr);
    case '^': {
      const r = a ** b;
      if (Number.isNaN(r)) throw new EvalError({ kind: 'error', message: 'a negative number to a fractional power', span: expr.span });
      return finite(r, expr);
    }
  }
}

/** Evaluate one expression. Never throws for calc errors; returns an error result instead. */
export function evaluateExpr(expr: Expr, lookup: Lookup, budget = new Budget(DEFAULT_LIMITS.maxSteps)): Result {
  try {
    return { kind: 'value', value: evalExpr(expr, lookup, budget) };
  } catch (e) {
    if (e instanceof EvalError) return e.result;
    throw e;
  }
}

/** Check a reader-supplied value for an input. Returns an error message, or undefined if it's acceptable. */
export function checkInputValue(program: Program, name: string, value: number): string | undefined {
  const def = program.inputs.find(d => d.name === name);
  if (!def) return `"${name}" is not an input`;
  if (!Number.isFinite(value)) return 'enter a number';
  if (def.range && (value < def.range.min || value > def.range.max)) return `enter a number from ${def.range.min} to ${def.range.max}`;
  return undefined;
}

/**
 * Evaluate a whole program. `values` overrides input defaults (invalid overrides are ignored).
 * Returns a result for every defined name, including broken ones.
 */
export function evaluate(program: Program, values: ReadonlyMap<string, number> = new Map(), limits: Limits = DEFAULT_LIMITS): Map<string, Result> {
  const results = new Map<string, Result>();
  for (const [name, d] of program.broken) results.set(name, { kind: 'error', message: d.message, span: d.span });
  const budget = new Budget(limits.maxSteps);
  for (const def of program.definitions) results.set(def.name, evaluateDefinition(program, def.name, results, values, budget));
  return results;
}

/** @internal Evaluate one definition given the results so far. */
export function evaluateDefinition(program: Program, name: string, results: ReadonlyMap<string, Result>, values: ReadonlyMap<string, number>, budget: Budget): Result {
  const index = program.names.get(name)?.index ?? -1;
  const def = index >= 0 ? program.definitions[index] : undefined;
  if (!def) return results.get(name) ?? { kind: 'error', message: `unknown name "${name}"` };
  if (def.kind === 'input') {
    const v = values.get(name);
    return { kind: 'value', value: v !== undefined && checkInputValue(program, name, v) === undefined ? v : def.default };
  }
  return evaluateExpr(def.expr, n => results.get(n), budget);
}
