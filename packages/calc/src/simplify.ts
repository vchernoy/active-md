import { constant } from './builtins.js';
import { Budget, evaluateExpr } from './evaluate.js';
import { DEFAULT_LIMITS, type Expr, type Program, type Range } from './types.js';

type Fact = { value?: number; range?: Range };
type Simplified = { expr: Expr; deps: ReadonlySet<string>; constant?: number };
const facts = new WeakMap<Program, ReadonlyMap<string, Fact>>();
const cost = (e: Expr): number => (e.steps ?? 1) + children(e).reduce((n, c) => n + cost(c), 0);
const children = (e: Expr): Expr[] => e.kind === 'bin' ? [e.left, e.right]
  : e.kind === 'not' || e.kind === 'neg' ? [e.arg] : e.kind === 'call' || e.kind === 'if' ? e.args : [];

/** References remaining after simplification (source validation happens before this pass). */
function references(e: Expr, out = new Set<string>()): Set<string> {
  if (e.kind === 'ref') out.add(e.name);
  for (const c of children(e)) references(c, out);
  return out;
}

function simplify(source: Expr, known: ReadonlyMap<string, Fact>, names: Program['names'], budget: Budget): Simplified {
  const literal = (e: Expr, value: number, steps = cost(e)): Expr => ({ kind: 'num', value, span: e.span, steps });
  const visit = (e: Expr): Expr => {
    budget.step();
    if (e.kind === 'num') return e;
    if (e.kind === 'ref') {
      const value = known.get(e.name)?.value ?? (!names.has(e.name) ? constant(e.name) : undefined);
      return value === undefined ? e : literal(e, value);
    }
    let next: Expr;
    if (e.kind === 'if') {
      // Only discard a leading, successfully constant condition. Later conditions
      // must retain their order relative to a dynamic (possibly failing) operand.
      const args = [...e.args];
      let steps = e.steps ?? 1;
      while (args.length > 1) {
        const condition = visit(args[0]!);
        if (condition.kind !== 'num') break;
        steps += cost(condition);
        if (condition.value !== 0) {
          const branch = visit(args[1]!);
          return { ...branch, steps: (branch.steps ?? 1) + steps };
        }
        args.splice(0, 2);
      }
      if (args.length === 1) {
        const branch = visit(args[0]!);
        return { ...branch, steps: (branch.steps ?? 1) + steps };
      }
      next = { ...e, steps, args: args.map(visit) };
    } else if (e.kind === 'bin') {
      const left = visit(e.left);
      if (left.kind === 'num' && ((e.op === 'and' && left.value === 0) || (e.op === 'or' && left.value !== 0)))
        return literal(e, e.op === 'or' ? 1 : 0, (e.steps ?? 1) + cost(left));
      const right = visit(e.right);
      next = { ...e, left, right };
      // Deliberately restrict interval proofs to a direct, total model input
      // (or a safe alias) versus a constant. No floating-point interval algebra.
      const interval = (x: Expr): Range | undefined => x.kind === 'num' ? { min: x.value, max: x.value }
        : x.kind === 'ref' ? known.get(x.name)?.range : undefined;
      const a = interval(left), b = interval(right);
      if (a && b) {
        let value: boolean | undefined;
        switch (e.op) {
          case '>': if (a.min > b.max) value = true; else if (a.max <= b.min) value = false; break;
          case '>=': if (a.min >= b.max) value = true; else if (a.max < b.min) value = false; break;
          case '<': if (a.max < b.min) value = true; else if (a.min >= b.max) value = false; break;
          case '<=': if (a.max <= b.min) value = true; else if (a.min > b.max) value = false; break;
          case '==': if (a.max < b.min || a.min > b.max) value = false; else if (a.min === a.max && a.min === b.min && b.min === b.max) value = true; break;
          case '!=': if (a.max < b.min || a.min > b.max) value = true; else if (a.min === a.max && a.min === b.min && b.min === b.max) value = false; break;
        }
        if (value !== undefined) return literal(next, Number(value));
      }
    } else if (e.kind === 'neg' || e.kind === 'not') next = { ...e, arg: visit(e.arg) };
    else next = { ...e, args: e.args.map(visit) };
    // Fold only successful closed expressions using the language evaluator.
    // Errors remain expressions, retaining their original diagnostic spans.
    if (!references(next).size) {
      const result = evaluateExpr(next, () => undefined, budget);
      if (result.kind === 'value') return literal(next, result.value);
    }
    return next;
  };
  const simplified = visit(source);
  // The original is a fallback for tight budgets or failed referenced names.
  // This preserves step-limit errors and dependency errors, even after a ref
  // to a compile-time constant has disappeared from the live dependency graph.
  const expr: Expr = { ...simplified, source, sourceCost: cost(source), guards: [...references(source)] };
  return { expr, deps: references(simplified), ...(simplified.kind === 'num' ? { constant: simplified.value } : {}) };
}

/** Bounded, conservative preparation; exhaustion leaves valid source expressions intact. */
export function simplifyProgram(program: Program): Program {
  const known = new Map<string, Fact>();
  const budget = new Budget(DEFAULT_LIMITS.maxSteps);
  const definitions = program.definitions.map(def => {
    if (def.kind === 'input') {
      known.set(def.name, def.range ? { range: def.range } : {});
      return def;
    }
    let next: Simplified;
    try { next = simplify(def.expr, known, program.names, budget); }
    catch (error) {
      if (budget.remaining() >= 0) throw error;
      known.set(def.name, {});
      return def;
    }
    const alias = next.expr.kind === 'ref' ? known.get(next.expr.name)?.range : undefined;
    known.set(def.name, next.constant !== undefined ? { value: next.constant } : alias ? { range: alias } : {});
    return { ...def, expr: next.expr, deps: next.deps };
  });
  const result = { ...program, definitions, source: program };
  facts.set(result, known);
  return result;
}

export function simplifyExpression(program: Program, expr: Expr, budget = new Budget(DEFAULT_LIMITS.maxSteps)): Simplified {
  const known = facts.get(program) ?? new Map<string, Fact>();
  try { return simplify(expr, known, program.names, budget); }
  catch (error) {
    if (budget.remaining() >= 0) throw error;
    return { expr, deps: references(expr) };
  }
}
