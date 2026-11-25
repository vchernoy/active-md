import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, createSession, parse } from '../src/index.js';
const program = (text: string, maxSteps = DEFAULT_LIMITS.maxSteps) => parse([{ id: 'model', text }], { ...DEFAULT_LIMITS, maxSteps });
describe('constant input metadata', () => {
  it('resolves preceding transitive constants, built-ins and negative expression bounds', () => {
    const p = program('limit = 100\ninitial = limit / 2\ninput amount = initial in -sqrt(limit)..limit + 10\ninput color = 2 ^ 3 + 1');
    expect(p.diagnostics).toEqual([]);
    expect(p.inputs.map(x => [x.name, x.default, x.range])).toEqual([
      ['amount', 50, { min: -10, max: 110 }], ['color', 9, undefined],
    ]);
    const session = createSession(p);
    expect(session.set('amount', 111)).toBeDefined();
    expect(session.get('amount')).toEqual({ kind: 'value', value: 50 });
  });
  it('distinguishes decimal points from range separators and applies precedence', () => {
    const p = program('input x = .5 + .25 in -2^2..1.5 + .5');
    expect(p.diagnostics).toEqual([]);
    expect(p.inputs[0]).toMatchObject({ default: .75, range: { min: -4, max: 2 } });
  });
  it.each(['input x = later\nlater = 5', 'input x = x', 'input x = missing', 'input x = if(0, missing, 5)'])('rejects invalid source references: %s', text => {
    const p = program(text);
    expect(p.inputs).toHaveLength(0);
    expect(p.diagnostics[0]?.span).toMatchObject({ block: 'model', line: 1 });
  });
  it.each([0, 7])('never treats reader defaults as constants (%s)', value => {
    const p = program(`input source = ${value}\nalias = source + 1\ninput x = alias\ninput y = 1 in 0..source`);
    expect(p.inputs.map(x => x.name)).toEqual(['source']);
    expect(p.diagnostics.filter(x => x.severity === 'error')).toHaveLength(2);
    expect(p.diagnostics.every(x => x.message.includes('constant'))).toBe(true);
  });
  it('accepts only dependencies removed by valid lazy/range simplification', () => {
    const p = program('input source = 2 in 1..10\ninput x = if(source > 0, 5, source)\ninput y = source * 0');
    expect(p.inputs.map(x => x.name)).toEqual(['source', 'x']);
    expect(p.inputs[1]?.default).toBe(5);
    expect(p.diagnostics[0]?.name).toBe('y');
  });
  it.each([
    ['input x = sqrt(-1)', /sqrt/], ['input x = 1 / 0', /division by zero/],
    ['input x = 1e308 * 10', /finite/], ['input x = sqrt(1, 2)', /argument/],
    ['input x = 3 in 1 + 4..2 * 2', /range 5..4 is empty/],
    ['input x = 3 * 4 in 0..10', /default 12 is outside/],
    ['bad = 1 / 0\ninput x = bad', /constant/],
  ])('reports positioned errors: %s', (text, message) => {
    const p = program(text);
    expect(p.inputs).toHaveLength(0);
    expect(p.diagnostics[0]?.message).toMatch(message);
    expect(p.diagnostics[0]?.span.block).toBe('model');
    expect(p.diagnostics[0]?.span.column).toBeGreaterThan(0);
  });
  it('bounds proof work and keeps legacy literals valid under tight budgets', () => {
    expect(program('input x = -2 in -3..0', 0).diagnostics).toEqual([]);
    const p = program('constant = 5 + 7\ninput x = constant / 2', 1);
    expect(p.inputs).toHaveLength(0);
    expect(p.diagnostics[0]?.message).toMatch(/constant|steps/);
  });
  it('resolves across blocks without allowing a later built-in shadow', () => {
    const p = parse([{ id: 'a', text: 'limit = 12' }, { id: 'b', text: 'input x = limit / 2 in -limit..limit' }]);
    expect(p.diagnostics).toEqual([]);
    expect(p.inputs[0]?.default).toBe(6);
    const shadow = program('input x = pi\npi = 3');
    expect(shadow.inputs).toHaveLength(0);
    expect(shadow.diagnostics[0]?.message).toMatch(/before it is defined/);
  });
  it('rejects runtime seed dependencies and incomplete metadata without losing later statements', () => {
    const p = program('input seed = 0\ndraw = rand(seed, 1)\ninput x = draw\ninput y = 1 in 0..\nafter = 4');
    expect(p.inputs.map(x => x.name)).toEqual(['seed']);
    expect(p.diagnostics.filter(x => x.severity === 'error')).toHaveLength(2);
    expect(createSession(p).get('after')).toEqual({ kind: 'value', value: 4 });
  });
  it('keeps source spans for expression evaluation errors', () => {
    const p = program('limit = 10\ninput x = 1 / 0 in 0..limit');
    expect(p.diagnostics[0]?.span).toMatchObject({ block: 'model', line: 2, column: 11 });
  });
});
