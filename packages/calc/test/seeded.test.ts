import { expect, it } from 'vitest';
import { createSession, DEFAULT_LIMITS, evaluate, parse, parseExpression } from '../src/index.js';
const program = (text: string) => parse([{ id: 'seeded', text }]);
const empty = createSession(program(''));

it.each([[0, 0, 0], [1, 0, 1364076727], [42, 0, 142593372], [42, 1, 939911724], [4294967295, 4294967295, 996586154]])(
  'v1 fixed word vector seed=%s draw=%s', (seed, draw, word) => {
    expect(empty.compile(`rand(${seed}, ${draw})`).evaluate()).toEqual({ kind: 'value', value: word! / 4294967296 });
  });
it('defaults to draw zero and derives separate reproducible draws', () => {
  expect(empty.compile('rand(42)').evaluate()).toEqual(empty.compile('rand(42, 0)').evaluate());
  expect(empty.compile('rand(42, 1)').evaluate()).not.toEqual(empty.compile('rand(42, 0)').evaluate());
  expect(empty.compile('randInt(42, 3, 12)').evaluate()).toEqual({ kind: 'value', value: 3 });
  expect(empty.compile('randInt(42, 3, 12, 1)').evaluate()).toEqual({ kind: 'value', value: 5 });
});
it('returns bounded finite draws and inclusive whole-number ranges, including negative and safe-edge bounds', () => {
  for (let seed = 0; seed < 256; seed++) {
    const draw = empty.compile(`rand(${seed})`).evaluate();
    expect(draw.kind).toBe('value');
    if (draw.kind === 'value') { expect(draw.value).toBeGreaterThanOrEqual(0); expect(draw.value).toBeLessThan(1); }
    const integer = empty.compile(`randInt(${seed}, -3, 3)`).evaluate();
    expect(integer.kind).toBe('value');
    if (integer.kind === 'value') { expect(Number.isInteger(integer.value)).toBe(true); expect(integer.value).toBeGreaterThanOrEqual(-3); expect(integer.value).toBeLessThanOrEqual(3); }
  }
  expect(empty.compile('randInt(0, -3, 3)').evaluate()).toEqual({ kind: 'value', value: -3 });
  // fmix32 inverse of 0xffffffff gives the uppermost possible draw.
  expect(empty.compile('randInt(857579651, -3, 3)').evaluate()).toEqual({ kind: 'value', value: 3 });
  expect(empty.compile('randInt(857579651, -2147483648, 2147483647)').evaluate()).toEqual({ kind: 'value', value: 2147483647 });
  expect(empty.compile('randInt(1, 7, 7)').evaluate()).toEqual({ kind: 'value', value: 7 });
  expect(empty.compile('randInt(1, 9007199254740990, 9007199254740991)').evaluate()).toEqual({ kind: 'value', value: 9007199254740990 });
  expect(empty.compile('randInt(0, -2147483648, 2147483647)').evaluate()).toEqual({ kind: 'value', value: -2147483648 });
});
it.each(['rand(-1)', 'rand(0.5)', 'rand(4294967296)', 'rand(1, -1)', 'rand(1, 0.5)',
  'randInt(1, 2, 1)', 'randInt(1, 0.5, 2)', 'randInt(1, 0, 4294967296)', 'randInt(1, 0, 9007199254740992)', 'randInt(1, 0, 2, -1)'])('%s reports a positioned domain error', text => {
  expect(createSession(program(`value = ${text}`)).get('value')).toMatchObject({ kind: 'error', message: expect.any(String), span: { block: 'seeded', line: 1, column: 9 } });
});
it.each(['rand()', 'rand(1,2,3)', 'randInt(1,2)', 'randInt(1,2,3,4,5)'])('%s rejects arity with a source position', text => {
  expect(parseExpression(program(''), text, 'binding').diagnostics[0]).toMatchObject({ severity: 'error', span: { block: 'binding', line: 1, column: 1 } });
});
it('keeps direct and transitive seed dependencies live, unrelated updates stable, and literal seeds foldable', () => {
  const p = program('input seed = 1\ninput unrelated = 2\na = rand(seed)\nb = a * 10\nc = randInt(seed, 3, 12, 1)\nfixed = rand(42)');
  expect(p.diagnostics).toEqual([]);
  const session = createSession(p);
  const bound = session.compile('b + c');
  expect([...bound.deps]).toEqual(['b', 'c']);
  expect([...p.definitions.find(def => def.name === 'a')!.deps]).toEqual(['seed']);
  expect([...p.definitions.find(def => def.name === 'b')!.deps]).toEqual(['a']);
  expect(bound.constant).toBeUndefined();
  const initial = bound.evaluate();
  session.set('unrelated', 9); expect(bound.evaluate()).toEqual(initial);
  session.set('seed', 42);
  expect(bound.evaluate()).toEqual(createSession(p).compile('rand(42) * 10 + randInt(42, 3, 12, 1)').evaluate());
  expect(bound.evaluate()).not.toEqual(initial);
  expect(session.compile('rand(42)').constant).toBe(142593372 / 4294967296);
  expect(session.compile('fixed').constant).toBe(142593372 / 4294967296);
});
it('retains lazy errors and original step accounting through preparation', () => {
  expect(empty.compile('if(0, rand(-1), 7)').evaluate()).toEqual({ kind: 'value', value: 7 });
  const p = program('input seed = 1\na = rand(seed)\nb = randInt(42, 0, 9) + a');
  for (let maxSteps = 0; maxSteps < 25; maxSteps++) {
    const limits = { ...DEFAULT_LIMITS, maxSteps };
    expect(evaluate(p, new Map([['seed', 42]]), limits)).toEqual(evaluate(p.source!, new Map([['seed', 42]]), limits));
  }
});
