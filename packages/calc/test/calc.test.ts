import { describe, expect, it } from 'vitest';
import { createSession, evaluate, formatNumber, parse, parseFormat, parseUserNumber, type Result } from '../src/index.js';

const prog = (...texts: string[]) => parse(texts.map((text, i) => ({ id: `b${i}`, text })));
const run = (...texts: string[]) => evaluate(prog(...texts));
const val = (r: Result | undefined) => (r?.kind === 'value' ? r.value : r);
const messages = (...texts: string[]) => prog(...texts).diagnostics.map(d => d.message);

describe('parse and evaluate', () => {
  it('evaluates inputs and values in order', () => {
    const r = run('input x = 5\ny = 10 * x\nz = y + x');
    expect(val(r.get('x'))).toBe(5);
    expect(val(r.get('y'))).toBe(50);
    expect(val(r.get('z'))).toBe(55);
  });

  it('follows precedence and associativity', () => {
    const r = run('a = 1 + 2 * 3\nb = 2 ^ 3 ^ 2\nc = -2 ^ 2\nd = (1 + 2) * 3\ne = 7 % 4\nf = 10 - 4 - 3\ng = 8 / 4 / 2\nh = 2 × 3 ÷ 4\ni = 1_000 + 1e3');
    expect([...'abcdefghi'].map(n => val(r.get(n)))).toEqual([7, 512, -4, 9, 3, 3, 1, 1.5, 2000]);
  });

  it('allows line breaks inside parentheses and comments', () => {
    const r = run('total = (1 +\n  2) // three\n// comment line\n\nx = total');
    expect(val(r.get('x'))).toBe(3);
  });

  it('supports the built-ins', () => {
    const r = run('a = round(3.14159, 2)\nb = round(2.5)\nc = min(3, 1, 2)\nd = max(3, 1, 2)\ne = abs(-4)\nf = floor(2.7)\ng = ceil(2.1)\nh = sqrt(16)');
    expect([...'abcdefgh'].map(n => val(r.get(n)))).toEqual([3.14, 3, 1, 3, 4, 2, 3, 4]);
  });

  it('shares names across blocks in document order', () => {
    const r = run('input rate = 8 in 0..100', 'growth = 1 + rate / 100');
    expect(val(r.get('growth'))).toBeCloseTo(1.08);
  });

  it('accepts Cyrillic names', () => {
    expect(val(run('input цена = 3\nитого = цена * 2').get('итого'))).toBe(6);
  });
});

describe('static rules', () => {
  it('rejects defining a name twice', () => {
    expect(messages('x = 1\nx = 2')[0]).toMatch(/already defined on line 1/);
  });

  it('rejects use before definition and says where the name is defined', () => {
    const p = prog('y = x * 2\nx = 1');
    expect(p.diagnostics[0]?.message).toMatch(/"x" is used before it is defined \(line 2\)/);
    expect(evaluate(p).get('y')?.kind).toBe('error');
    expect(val(evaluate(p).get('x'))).toBe(1);
  });

  it('rejects self-reference', () => {
    expect(messages('x = x + 1')[0]).toMatch(/can't refer to itself/);
  });

  it('reports unknown names, unknown functions and wrong arity', () => {
    expect(messages('y = q')[0]).toMatch(/unknown name "q"/);
    expect(messages('y = foo(1)')[0]).toMatch(/unknown function "foo"/);
    expect(messages('y = sqrt(1, 2)')[0]).toMatch(/sqrt takes 1 argument, got 2/);
    expect(messages('y = round()')[0]).toMatch(/round takes 1 or 2 arguments, got 0/);
  });

  it('rejects functions, reserved words and built-in names as definitions', () => {
    expect(messages('f(x) = x * 2')[0]).toMatch(/functions are not supported yet/);
    expect(messages('in = 3')[0]).toMatch(/reserved word/);
    expect(messages('sqrt = 3')[0]).toMatch(/built-in function/);
  });

  it('checks input ranges and defaults', () => {
    expect(messages('input x = 5 in 10..1')[0]).toMatch(/range 10..1 is empty/);
    expect(messages('input x = 50 in 0..10')[0]).toMatch(/default 50 is outside 0..10/);
    expect(messages('input x = y')[0]).toMatch(/unknown name/);
    const p = prog('input t = -5 in -10..10');
    expect(p.diagnostics).toEqual([]);
    expect(p.inputs[0]?.range).toEqual({ min: -10, max: 10 });
  });

  it('keeps going after a bad line, and errors spread to dependents', () => {
    const p = prog('a = 1 +\nb = 2\nc = 3 $ 4\nd = b * 2');
    expect(p.diagnostics.length).toBe(2);
    const r = evaluate(p);
    expect(val(r.get('b'))).toBe(2);
    expect(val(r.get('d'))).toBe(4);
  });

  it('marks dependents of a broken definition', () => {
    const r = run('a = nope\nb = a + 1');
    expect(r.get('b')).toMatchObject({ kind: 'error', message: 'depends on an error in a' });
  });

  it('reports trailing text', () => {
    expect(messages('x = 1 2')[0]).toMatch(/unexpected "2"/);
  });
});

describe('runtime errors', () => {
  it('turns division by zero, overflow and bad math into errors', () => {
    const r = run('input d = 0\na = 1 / d\nb = 10 ^ 400\nc = sqrt(-1)\ne = (-8) ^ 0.5\nf = a + 1\ng = 5 % 0');
    expect(r.get('a')).toMatchObject({ kind: 'error', message: 'division by zero' });
    expect(r.get('b')).toMatchObject({ kind: 'error', message: 'result is not a finite number' });
    expect(r.get('c')).toMatchObject({ kind: 'error', message: 'sqrt of a negative number' });
    expect(r.get('e')).toMatchObject({ kind: 'error' });
    expect(r.get('f')).toMatchObject({ kind: 'error', message: 'depends on an error in a' });
    expect(r.get('g')).toMatchObject({ kind: 'error' });
  });
});

describe('limits', () => {
  it('limits source length, definitions, depth and steps', () => {
    expect(parse([{ id: 'a', text: 'x = 1\n'.repeat(20) }], { maxSourceLength: 10, maxDefinitions: 10, maxSteps: 100, maxDepth: 50 }).diagnostics[0]?.message).toMatch(/too long/);
    expect(parse([{ id: 'a', text: Array.from({ length: 20 }, (_, i) => `x${i} = 1`).join('\n') }], { maxSourceLength: 1e5, maxDefinitions: 10, maxSteps: 100, maxDepth: 50 }).diagnostics[0]?.message).toMatch(/too many definitions/);
    expect(messages(`x = ${'('.repeat(300)}1${')'.repeat(300)}`)[0]).toMatch(/nested too deeply/);
    const limits = { maxSourceLength: 1e5, maxDefinitions: 100, maxSteps: 20, maxDepth: 200 };
    const p = parse([{ id: 'a', text: 'a = 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1' }], limits);
    expect(evaluate(p, new Map(), limits).get('a')).toMatchObject({ kind: 'error', message: expect.stringMatching(/too many steps/) });
  });
});

describe('session', () => {
  const src = 'input principal = 1000 in 0..1000000\ninput rate = 5 in 0..100\nfactor = 1 + rate / 100\nfinal = principal * factor\nlabel = 42';

  it('recomputes only what changed and notifies listeners', () => {
    const s = createSession(prog(src));
    const seen: string[][] = [];
    s.subscribe(c => seen.push([...c].sort()));
    expect(val(s.get('final'))).toBeCloseTo(1050);
    expect(s.set('principal', 2000)).toBeUndefined();
    expect(val(s.get('final'))).toBeCloseTo(2100);
    expect(s.set('rate', 10)).toBeUndefined();
    expect(seen).toEqual([['final', 'principal'], ['factor', 'final', 'rate']]);
  });

  it('rejects out-of-range values and unknown inputs without changing anything', () => {
    const s = createSession(prog(src));
    expect(s.set('rate', 101)).toMatch(/from 0 to 100/);
    expect(s.set('factor', 1)).toMatch(/not an input/);
    expect(s.set('rate', Number.NaN)).toMatch(/enter a number/);
    expect(val(s.get('rate'))).toBe(5);
  });

  it('resets to defaults', () => {
    const s = createSession(prog(src));
    s.set('rate', 50);
    s.reset();
    expect(val(s.get('final'))).toBeCloseTo(1050);
    expect(s.inputValues().get('rate')).toBe(5);
  });

  it('compiles binding expressions against the program', () => {
    const s = createSession(prog(src));
    const e = s.compile('round(final - principal, 1)');
    expect([...e.deps].sort()).toEqual(['final', 'principal']);
    expect(val(e.evaluate())).toBe(50);
    s.set('principal', 100);
    expect(val(e.evaluate())).toBe(5);
    expect(s.compile('nope + 1').diagnostics[0]?.message).toMatch(/unknown name/);
    expect(s.compile('1 +').evaluate().kind).toBe('error');
    // A bare name shows its own error; an expression says what it depends on.
    const z = createSession(prog('input d = 0\nq = 1 / d'));
    expect(z.compile('q').evaluate()).toMatchObject({ kind: 'error', message: 'division by zero' });
    expect(z.compile('q + 1').evaluate()).toMatchObject({ kind: 'error', message: 'depends on an error in q' });
  });

  it('unsubscribes', () => {
    const s = createSession(prog(src));
    let n = 0;
    const off = s.subscribe(() => n++);
    off();
    s.set('rate', 1);
    expect(n).toBe(0);
  });
});

describe('format', () => {
  it('formats numbers', () => {
    expect(formatNumber(1234.5678, { kind: 'fixed', digits: 2 }, 'en-US')).toBe('1,234.57');
    expect(formatNumber(0.0825, { kind: 'percent', digits: 1 }, 'en-US')).toBe('8.3%');
    expect(formatNumber(2.5, { kind: 'int' }, 'en-US')).toBe('3');
    expect(formatNumber(1 / 3, undefined, 'en-US')).toBe('0.333333');
    expect(formatNumber(-0.001, { kind: 'fixed', digits: 1 }, 'en-US')).toBe('0.0');
    expect(formatNumber(1234.5, { kind: 'fixed', digits: 1 }, 'de-DE')).toBe('1.234,5');
  });

  it('parses format specs', () => {
    expect(parseFormat('fixed')).toEqual(parseFormat('fixed:0'));
    expect(parseFormat('fixed:2')).toEqual({ kind: 'fixed', digits: 2 });
    expect(parseFormat(undefined)).toEqual({ kind: 'auto' });
    expect(parseFormat('money')).toMatch(/unknown format/);
  });

  it('parses numbers typed by readers', () => {
    expect(parseUserNumber('1,234.5', 'en-US')).toBe(1234.5);
    expect(parseUserNumber(' -3 ', 'en-US')).toBe(-3);
    expect(parseUserNumber('−2.5', 'en-US')).toBe(-2.5);
    expect(parseUserNumber('1 000', 'en-US')).toBe(1000);
    expect(parseUserNumber('1,5', 'en-US')).toBeUndefined();
    expect(parseUserNumber('1.234,5', 'de-DE')).toBe(1234.5);
    expect(parseUserNumber('2,5', 'de-DE')).toBe(2.5);
    expect(parseUserNumber('2.5', 'de-DE')).toBe(2.5);
    expect(parseUserNumber('abc', 'en-US')).toBeUndefined();
    expect(parseUserNumber('', 'en-US')).toBeUndefined();
    expect(parseUserNumber('1e400', 'en-US')).toBeUndefined();
  });
});

describe('program shape', () => {
  it('indexes valid definitions and marks broken ones', () => {
    const p = prog('input a = 1\nb = nope\nc = a + 1');
    expect(p.names.get('a')?.index).toBe(0);
    expect(p.names.get('b')?.index).toBe(-1);
    expect(p.names.get('c')?.index).toBe(1);
    expect(p.definitions[p.names.get('c')!.index]?.name).toBe('c');
  });
});

describe('review fixes (#3)', () => {
  const chain = (n: number, op = '+') => Array(n).fill('1').join(` ${op} `);

  it('rejects long flat operator chains with a diagnostic instead of overflowing the stack', () => {
    for (const op of ['+', '*', '-', '^']) {
      const p = prog(`x = ${chain(10_000, op)}\ny = 2`);
      expect(p.diagnostics[0]?.message).toMatch(/nested too deeply/);
      const r = evaluate(p);
      expect(r.get('x')?.kind).toBe('error');
      expect(val(r.get('y'))).toBe(2);
    }
    const s = createSession(prog('input a = 1'));
    const e = s.compile(chain(10_000));
    expect(e.diagnostics[0]?.message).toMatch(/nested too deeply/);
    expect(e.evaluate().kind).toBe('error');
    // Chains within the limit still work.
    expect(val(run(`x = ${chain(150)}`).get('x'))).toBe(150);
  });

  it('treats inherited object properties as unknown functions, not built-ins', () => {
    for (const fn of ['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf']) {
      const p = prog(`x = ${fn}(1)`);
      expect(p.diagnostics[0]?.message).toBe(`unknown function "${fn}"`);
      expect(evaluate(p).get('x')?.kind).toBe('error');
      expect(createSession(prog('input a = 1')).compile(`${fn}(a)`).evaluate().kind).toBe('error');
    }
    // Such names are ordinary names, not reserved.
    expect(val(run('toString = 3\ny = toString * 2').get('y'))).toBe(6);
  });

  it('keeps the names of definitions that fail to parse', () => {
    const p = prog('a = 1 +\na = 2\nb = a');
    expect(p.diagnostics.map(d => d.message)).toEqual([
      'the expression is incomplete',
      expect.stringMatching(/"a" is already defined on line 1/),
    ]);
    const r = evaluate(p);
    expect(r.get('a')).toMatchObject({ kind: 'error', message: 'the expression is incomplete' });
    expect(r.get('b')).toMatchObject({ kind: 'error', message: 'depends on an error in a' });
    expect(evaluate(prog('a = 1 +')).get('a')?.kind).toBe('error');
    expect(evaluate(prog('input n = x')).get('n')?.kind).toBe('error');
    // A later reference reports "used before defined", not "unknown name".
    expect(messages('b = c\nc = (')[0]).toMatch(/"c" is used before it is defined \(line 2\)/);
    // A broken duplicate reports both problems.
    expect(messages('a = 1\na = 2 +')).toEqual([expect.stringMatching(/already defined/), 'the expression is incomplete']);
  });

  it('never shows negative zero, in any locale', () => {
    expect(formatNumber(-0.0001, { kind: 'percent', digits: 1 }, 'de-DE')).toBe(formatNumber(0, { kind: 'percent', digits: 1 }, 'de-DE'));
    expect(formatNumber(-0.0001, { kind: 'percent', digits: 1 }, 'de-DE')).not.toMatch(/^[-−]/);
    expect(formatNumber(-0.0001, { kind: 'fixed', digits: 2 }, 'sv-SE')).toBe(formatNumber(0, { kind: 'fixed', digits: 2 }, 'sv-SE'));
    expect(formatNumber(-0.0001, { kind: 'fixed', digits: 1 }, 'ar-EG')).toBe(formatNumber(0, { kind: 'fixed', digits: 1 }, 'ar-EG'));
    expect(formatNumber(-0.4, { kind: 'int' }, 'en-US')).toBe('0');
    expect(formatNumber(-0, undefined, 'en-US')).toBe('0');
    expect(formatNumber(-0.06, { kind: 'fixed', digits: 1 }, 'en-US')).toBe('-0.1');
  });
});
