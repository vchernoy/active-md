import { describe, expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const model = '```calc\ninput k = 2\ninput j = 1\ndouble = k * 2\nbig = double > 5\n```\n\n';
describe('static conditional control analysis', () => {
  it.each(['k < 5', 'not big'])('rejects self-hiding controls through %s', condition => {
    const r = renderActive(model + `:::when[${condition}]\n:input[k]\n:::`);
    expect(r.messages).toContainEqual(expect.objectContaining({ severity: 'error', line: 8, column: 1, message: expect.stringContaining('k can hide its own only control') }));
  });
  it('includes enclosing conditions for nested controls', () => {
    const r = renderActive(model + '::::when[k]\n:::when[1]\n:input[k]\n:::\n::::');
    expect(r.messages.some(m => m.message.includes('k can hide'))).toBe(true);
  });
  it('accepts an outside control regardless of default visibility', () => {
    const r = renderActive(model + ':input[k]\n\n:::when[not big]\n:input[k]\n:::');
    expect(r.messages).toEqual([]);
  });
  it('reports a cross-block cycle as warning only', () => {
    const r = renderActive(model + ':::when[j]\n:input[k]\n:::\n\n:::when[k]\n:input[j]\n:::');
    expect(r.messages).toContainEqual(expect.objectContaining({ severity: 'warning', line: expect.any(Number), message: expect.stringContaining('cycle between') }));
    expect(r.messages.some(m => m.severity === 'error')).toBe(false);
  });
  it('does not try to prove satisfiability or warn for an acyclic graph', () => {
    expect(renderActive(model + ':input[k]\n\n:::when[k > 100]\n:input[j]\n:::').messages).toEqual([]);
  });
});
