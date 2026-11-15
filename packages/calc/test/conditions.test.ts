import { describe, expect, it } from 'vitest';
import { createSession, DEFAULT_LIMITS, evaluate, parse, parseExpression, evaluateExpr } from '../src/index.js';
import { Budget } from '../src/evaluate.js';
const program = parse([{ id: 'test', text: 'input x = 0' }]);
function result(text: string, steps = 1000) {
  const c = parseExpression(program, text);
  expect(c.diagnostics).toEqual([]);
  return evaluateExpr(c.expr!, () => ({ kind: 'value', value: 0 }), new Budget(steps));
}
describe('conditions', () => {
  it.each([
    ['(1 < 2) == 1', 1], ['(1 < 2) == (3 < 4)', 1], ['2 == 2', 1], ['2 != 2', 0], ['1 < 2', 1], ['2 <= 2', 1], ['3 > 2', 1], ['3 >= 4', 0],
    ['1 + 2 * 3 == 7', 1], ['not 2 < 3', 0], ['1 or 0 and 0', 1], ['not 0 and -2', 1],
    ['-2^2 == -4', 1], ['0.1 + 0.2 == 0.3', 0], ['abs(0.1 + 0.2 - 0.3) < 1e-9', 1],
    ['if(x != 0, 1/x, 0)', 0], ['if(0, 1/0, 1, 42, sqrt(-1))', 42],
    ['if(0, 1/0, 0, sqrt(-1), 7)', 7], ['0 and 1/0', 0], ['2 or sqrt(-1)', 1],
    ['even(-4)', 1], ['odd(-3)', 1], ['even(-3)', 0], ['odd(-2.6)', 1], ['even(1.5)', 1], ['-3 % 2', -1],
  ])('%s => %s', (text, value) => expect(result(text)).toEqual({ kind: 'value', value }));
  it.each(['if(1, 2)', 'if(1, 2, 0, 3)', '1 < 2 < 3', 'not', '1 and', 'even()', 'odd(1, 2)', 'if(1, 2, unknown)'])('positions invalid %s', text => {
    const c = parseExpression(program, text, 'binding');
    expect(c.diagnostics.length).toBeGreaterThan(0);
    expect(c.diagnostics[0]!.span).toMatchObject({ block: 'binding', line: 1 });
    expect(c.diagnostics[0]!.span.column).toBeGreaterThan(0);
  });
  it.each(['if', 'and', 'or', 'not', 'even', 'odd'])('reserves %s', name => {
    expect(parse([{ id: 'a', text: `input ${name} = 1` }]).diagnostics[0]!.span.column).toBe(7);
  });
  it('preserves positioned runtime errors and budgets only executed nodes', () => {
    expect(result('if(1, 1/0, 0)')).toMatchObject({ kind: 'error', span: { line: 1, column: 7 } });
    expect(result('if(1, 9, 1+2+3+4)', 3)).toEqual({ kind: 'value', value: 9 });
    expect(result('if(0, 9, 1+2+3+4)', 3)).toMatchObject({ kind: 'error', message: expect.stringContaining('too many steps') });
    const p = parse([{ id: 'a', text: 'v = if(0, 9, 1+2+3)' }]);
    expect(evaluate(p, new Map(), { ...DEFAULT_LIMITS, maxSteps: 2 }).get('v')?.kind).toBe('error');
  });
  it('keeps dependencies in unselected branches and updates deterministically', () => {
    const p = parse([{ id: 'a', text: 'input x = 0\ny = if(x, 1/x, 0)' }]);
    const s = createSession(p);
    expect(s.get('y')).toEqual({ kind: 'value', value: 0 });
    s.set('x', 2);
    expect(s.get('y')).toEqual({ kind: 'value', value: 0.5 });
    s.set('x', 0);
    expect(s.get('y')).toEqual({ kind: 'value', value: 0 });
  });
});
