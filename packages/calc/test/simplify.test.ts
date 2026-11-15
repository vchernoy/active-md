import { describe, expect, it } from 'vitest';
import { createSession, DEFAULT_LIMITS, evaluate, evaluateExpr, parse, parseExpression } from '../src/index.js';
import { simplifyExpression } from '../src/simplify.js';
import { Budget } from '../src/evaluate.js';
import type { Expr, Program } from '../src/index.js';

const program = (text: string) => parse([{ id: 'calc-1', text }]);
const expr = (p: Program, name: string): Expr => {
  const def = p.definitions.find(d => d.name === name)!;
  if (def.kind !== 'value') throw new Error('not a value');
  return def.expr;
};

describe('semantics-preserving preparation', () => {
  it('propagates constants transitively and folds inside live expressions', () => {
    const p = program('x = 10\ny = x + 5\ninput n = 2\nz = n + y * 2');
    expect(expr(p, 'y')).toMatchObject({ kind: 'num', value: 15 });
    expect(expr(p, 'z')).toMatchObject({ kind: 'bin', right: { kind: 'num', value: 30 } });
    expect([...p.definitions[3]!.deps]).toEqual(['n']);
    const s = createSession(p);
    expect(s.get('z')).toEqual({ kind: 'value', value: 32 });
    s.set('n', 5);
    expect(s.get('z')).toEqual({ kind: 'value', value: 35 });
    expect(s.compile('x + y').constant).toBe(25);
  });

  it('does not treat defaults as constants; uses only enforced model ranges', () => {
    const p = program('input x = 0 in 0..10\ninput free = 0\nalias = x');
    const s = createSession(p);
    for (const [text, expected] of [['x > 20', 0], ['x <= 10', 1], ['alias != 11', 1], ['x < 0', 0], ['x >= 0', 1]] as const) {
      const c = s.compile(text);
      expect(c.constant).toBe(expected);
      expect([...c.deps]).toEqual([]);
    }
    expect(s.compile('x >= 10').constant).toBeUndefined();
    expect(s.compile('x > 5').constant).toBeUndefined();
    expect(s.compile('free > 20').constant).toBeUndefined();
    expect(s.set('x', 11)).toContain('0 to 10');
    expect(evaluate(p, new Map([['x', 11]])).get('x')).toEqual({ kind: 'value', value: 0 });
    s.set('x', 10);
    expect(s.compile('x >= 10').evaluate()).toEqual({ kind: 'value', value: 1 });
    s.reset();
    expect(s.compile('x >= 10').evaluate()).toEqual({ kind: 'value', value: 0 });
  });

  it('eliminates only unreachable lazy operands and normalizes Boolean results', () => {
    const s = createSession(program('input x = 2 in 0..10\na = 1 or x\nb = 0 and x\nc = if(0, x, 1, 7, x)'));
    for (const name of ['a', 'b', 'c']) expect([...s.program.definitions.find(d => d.name === name)!.deps]).toEqual([]);
    expect(s.get('a')).toEqual({ kind: 'value', value: 1 });
    expect(s.get('b')).toEqual({ kind: 'value', value: 0 });
    expect(s.get('c')).toEqual({ kind: 'value', value: 7 });
    expect(s.compile('2 and x').evaluate()).toEqual({ kind: 'value', value: 1 });
    expect(s.compile('if(0, log(-1), x)').evaluate()).toEqual({ kind: 'value', value: 2 });
    expect(s.compile('log(-1) and 0').evaluate()).toMatchObject({ kind: 'error', message: 'log: argument must be positive', span: { block: 'expression', column: 1 } });
    expect(s.compile('x * 0').constant).toBeUndefined();
  });

  it('retains validation, domain errors, operand order and source positions', () => {
    const p = program('a = 1 or missing\nb = log(-1)\nc = b + 2');
    expect(p.diagnostics[0]).toMatchObject({ message: 'unknown name "missing"', span: { line: 1, column: 10 } });
    expect(evaluate(p).get('b')).toMatchObject({ kind: 'error', span: { line: 2, column: 5 } });
    expect(evaluate(p).get('c')).toMatchObject({ kind: 'error', message: 'depends on an error in b', span: { line: 3, column: 5 } });
    const s = createSession(program('input x = 0\na = x + 1 / 0'));
    expect(s.compile('a').evaluate()).toEqual(s.get('a'));
    expect(s.compile('if(0, unknown, 1)').diagnostics[0]?.message).toContain('unknown');
    const mixed = parseExpression(s.program, 'x + (1 / 0)', 'binding').expr!;
    expect(evaluateExpr(mixed, () => ({ kind: 'error', message: 'bad input' }))).toMatchObject({ kind: 'error', message: 'depends on an error in x', span: { column: 1 } });
  });

  it('preserves exact results and errors at every restrictive step budget', () => {
    const p = program('a = 1 + 2 * 3\ninput x = 0 in 0..10\nb = if(x, a + 4, 8)\nc = a + b\nd = x > 20');
    for (let maxSteps = 0; maxSteps < 45; maxSteps++) {
      const limits = { ...DEFAULT_LIMITS, maxSteps };
      for (const x of [0, 10]) {
        expect(evaluate(p, new Map([['x', x]]), limits)).toEqual(evaluate(p.source!, new Map([['x', x]]), limits));
      }
      const s = createSession(p, limits);
      s.set('x', 10);
      const raw = createSession(p.source!, limits);
      raw.set('x', 10);
      for (const d of p.definitions) expect(s.get(d.name)).toEqual(raw.get(d.name));
      const c = s.compile('if(x, a + 5, 4)');
      const original = parseExpression(p.source!, 'if(x, a + 5, 4)').expr!.source!;
      expect(c.evaluate()).toEqual(evaluateExpr(original, name => s.get(name), new Budget(maxSteps)));
    }
  });
  it('matches original evaluation across lazy paths, errors, floating-point edges and budgets', () => {
    const p = program('input x = 0 in -10..10\na = 2 + 3\nb = -0');
    const expressions = ['not (x > 20)', 'x > 20 and 1/0', 'x <= 10 or log(-1)',
      'if(0, log(-1), x, a + 2, 1, x*3, 1/0)', 'if(x, 1/0, 1+2)',
      'x + 1/0', '1/0 + x', '0 * (1/0)', 'x / (2-2)', '2 and x',
      'x or (2+3)', '-(x + (1+2))', 'round(x + (1+2), 2)', 'sin(pi/2) + x',
      '(1e16 + 1) - 1e16 + x', '1 / b', '(-0) * x'];
    for (const text of expressions) {
      const prepared = parseExpression(p, text).expr!;
      expect(prepared).toBeDefined();
      for (const x of [-10, -0, 0, 1, 10]) {
        const values = evaluate(p, new Map([['x', x]]));
        for (let limit = 0; limit < 40; limit++) {
          expect(evaluateExpr(prepared, name => values.get(name), new Budget(limit)), text)
            .toEqual(evaluateExpr(prepared.source!, name => values.get(name), new Budget(limit)));
        }
      }
    }
  });

  it('falls back to validated source when preparation exhausts its work budget', () => {
    const p = program('input x = 0');
    const original = parseExpression(p, 'x + (2*3)').expr!.source!;
    const prepared = simplifyExpression(p, original, new Budget(1));
    expect(prepared.expr).toBe(original);
    expect([...prepared.deps]).toEqual(['x']);
    expect(evaluateExpr(prepared.expr, () => ({ kind: 'value', value: 1 }))).toEqual({ kind: 'value', value: 7 });
  });

});
