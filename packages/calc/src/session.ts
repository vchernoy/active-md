import { Budget, checkInputValue, evaluate, evaluateDefinition, evaluateExpr } from './evaluate.js';
import { parseExpression } from './parser.js';
import { DEFAULT_LIMITS, type Diagnostic, type Limits, type Program, type Result } from './types.js';

export type Session = {
  readonly program: Program;
  /** Current result of a name, or undefined if the name isn't defined. */
  get(name: string): Result | undefined;
  /** Current value of every input. */
  inputValues(): ReadonlyMap<string, number>;
  /** Set an input. Returns an error message (and changes nothing) if the value is rejected. */
  set(name: string, value: number): string | undefined;
  /** Put every input back to its default. */
  reset(): void;
  /** Called with the names whose result changed, after each set/reset. Returns an unsubscribe function. */
  subscribe(listener: (changed: ReadonlySet<string>) => void): () => void;
  /** Compile an expression against this program (for bindings such as :value[expr]). */
  compile(text: string, id?: string): CompiledExpression;
};

export type CompiledExpression = {
  readonly deps: ReadonlySet<string>;
  readonly diagnostics: readonly Diagnostic[];
  /** Evaluate against the session's current results. */
  evaluate(): Result;
};

const same = (a: Result | undefined, b: Result | undefined): boolean =>
  a?.kind === b?.kind && (a?.kind === 'value' ? Object.is(a.value, (b as typeof a).value) : a?.kind !== 'error' || a.message === (b as typeof a).message);

/** A live evaluation of a program: inputs can change, and only affected names are recomputed. */
export function createSession(program: Program, limits: Limits = DEFAULT_LIMITS): Session {
  const values = new Map<string, number>(program.inputs.map(i => [i.name, i.default]));
  let results = evaluate(program, values, limits);
  const listeners = new Set<(changed: ReadonlySet<string>) => void>();

  // Definitions are in a valid order, so one forward pass over the affected ones is enough.
  const recompute = (dirty: Set<string>): void => {
    const changed = new Set<string>();
    const next = new Map(results);
    const budget = new Budget(limits.maxSteps);
    for (const def of program.definitions) {
      const affected = dirty.has(def.name) || [...def.deps].some(d => changed.has(d));
      if (!affected) continue;
      const r = evaluateDefinition(program, def.name, next, values, budget);
      if (!same(r, next.get(def.name))) changed.add(def.name);
      next.set(def.name, r);
    }
    results = next;
    if (changed.size) for (const l of [...listeners]) l(changed);
  };

  return {
    program,
    get: name => results.get(name),
    inputValues: () => new Map(values),
    set(name, value) {
      const problem = checkInputValue(program, name, value);
      if (problem) return problem;
      if (Object.is(values.get(name), value)) return undefined;
      values.set(name, value);
      recompute(new Set([name]));
      return undefined;
    },
    reset() {
      const dirty = new Set<string>();
      for (const i of program.inputs) if (!Object.is(values.get(i.name), i.default)) { values.set(i.name, i.default); dirty.add(i.name); }
      if (dirty.size) recompute(dirty);
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    compile(text, id) {
      const c = parseExpression(program, text, id, limits);
      return {
        deps: c.deps,
        diagnostics: c.diagnostics,
        evaluate: () => c.expr
          // A bare name shows that name's own result, including its error message.
          ? c.expr.kind === 'ref' ? results.get(c.expr.name) ?? { kind: 'error', message: `unknown name "${c.expr.name}"` }
          : evaluateExpr(c.expr, n => results.get(n), new Budget(limits.maxSteps))
          : { kind: 'error', message: c.diagnostics[0]?.message ?? 'invalid expression', ...(c.diagnostics[0] ? { span: c.diagnostics[0].span } : {}) },
      };
    },
  };
}
