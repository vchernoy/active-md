import { expect, it } from 'vitest';
import { createSession, DEFAULT_LIMITS, evaluate, parse, parseExpression } from '../src/index.js';
const program = (text: string) => parse([{ id: 'model', text }]);
const session = createSession(program(''));

it.each([
  ['ln(e)', 1], ['log(100)', 2], ['log(8, 2)', 3], ['exp(1)', Math.E],
  ['sin(pi/2)', 1], ['cos(pi)', -1], ['tan(pi/4)', 1], ['asin(1)', Math.PI/2],
  ['acos(-1)', Math.PI], ['atan(1)', Math.PI/4], ['atan2(1, -1)', 3*Math.PI/4],
  ['deg(pi)', 180], ['rad(180)', Math.PI], ['pi', Math.PI], ['e', Math.E],
])('%s gives a finite value within 1e-12', (text, expected) => {
  const c = session.compile(text);
  expect(c.diagnostics).toEqual([]);
  const r = c.evaluate();
  expect(r.kind).toBe('value');
  if (r.kind === 'value') expect(Math.abs(r.value - expected)).toBeLessThan(1e-12);
});
it.each(['ln(0)', 'ln(-1)', 'log(0)', 'log(-1)', 'log(2, 0)', 'log(2, -1)', 'log(2, 1)', 'exp(1000)', 'asin(2)', 'asin(-2)', 'acos(2)', 'acos(-2)', 'deg(1e308)'])('%s is a positioned error value', text => {
  const result = createSession(program(`value = ${text}`)).get('value');
  expect(result).toMatchObject({ kind: 'error', message: expect.any(String), span: { block: 'model', line: 1, column: 9 } });
});
for (const [name, min, max] of [['ln', 1, 1], ['log', 1, 2], ['exp', 1, 1], ['sin', 1, 1], ['cos', 1, 1], ['tan', 1, 1], ['asin', 1, 1], ['acos', 1, 1], ['atan', 1, 1], ['atan2', 2, 2], ['deg', 1, 1], ['rad', 1, 1]] as const) {
  it(`${name} rejects too few/many arguments with positions`, () => {
    for (const count of [min - 1, max + 1]) {
      const c = parseExpression(program(''), `${name}(${Array(count).fill('1').join(',')})`, 'binding');
      expect(c.diagnostics[0]).toMatchObject({ severity: 'error', message: expect.stringContaining('argument'), span: { block: 'binding', line: 1, column: 1 } });
    }
  });
}
it('constants are available in definitions and bare bindings, without mutable dependencies', () => {
  expect(createSession(program('area = pi * 4')).get('area')).toEqual({ kind: 'value', value: Math.PI * 4 });
  expect(session.get('e')).toEqual({ kind: 'value', value: Math.E });
  expect([...session.compile('pi + e').deps]).toEqual([]);
});
it.each(['pi', 'e'])('a definition or input shadows %s with a positioned warning and live dependencies', name => {
  const p = program(`input ${name} = 3\nvalue = ${name} * 2`);
  expect(p.diagnostics).toEqual([expect.objectContaining({ severity: 'warning', span: { block: 'model', start: 6, end: 6 + name.length, line: 1, column: 7 }, message: expect.stringContaining('shadows') })]);
  const live = createSession(p);
  expect(live.compile(name).evaluate()).toEqual({ kind: 'value', value: 3 });
  expect([...live.compile(name).deps]).toEqual([name]);
  live.set(name, 4);
  expect(live.get('value')).toEqual({ kind: 'value', value: 8 });
  expect(createSession(program(`${name} = 5\nvalue = ${name}`)).get('value')).toEqual({ kind: 'value', value: 5 });
});
it('shadowing preserves define-before-use, self-reference and broken-name errors', () => {
  expect(program('value = pi\npi = 3').diagnostics).toContainEqual(expect.objectContaining({ severity: 'error', message: expect.stringContaining('before') }));
  expect(createSession(program('e = e + 1')).get('e')?.kind).toBe('error');
  expect(createSession(program('e = unknown')).compile('e').evaluate().kind).toBe('error');
});
it('new calls keep the existing evaluation budget and lazy branch behavior', () => {
  const p = program('value = exp(1)');
  expect(evaluate(p, new Map(), { ...DEFAULT_LIMITS, maxSteps: 1 }).get('value')?.kind).toBe('error');
  expect(evaluate(p, new Map(), { ...DEFAULT_LIMITS, maxSteps: 2 }).get('value')).toEqual({ kind: 'value', value: Math.E });
  expect(session.compile('if(0, ln(0), 1)').evaluate()).toEqual({ kind: 'value', value: 1 });
});
