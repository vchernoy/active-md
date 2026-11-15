import { describe, expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const model = '```calc\ninput x = 0\n```\n\n';
describe('when rendering', () => {
  it('keeps hidden content without evaluating bindings, nested conditions or TeX', () => {
    const r = renderActive(model + '::::when[x]\n:value[1/x]\n\n$$ {{1/x}} $$\n\n:::when[1/0]\n:value[unknown]\n:::\n::::');
    expect(r.messages).toEqual([]);
    expect(r.html).toContain('data-active-when="x"');
    expect(r.html).toContain('hidden');
    expect(r.html).toContain('data-active-value="1/x"');
    expect(r.html).not.toContain('active-error');
    expect(r.html).not.toContain('division by zero');
    expect(r.html).not.toContain('mathcolor="red"');
  });
  it.each(['1/0', 'unknown', 'x >'])('hides a bad condition %s and positions its error', expr => {
    const r = renderActive(model + `:::when[${expr}]\nBody\n:::`);
    expect(r.messages[0]).toMatchObject({ line: 5, column: 1, severity: 'error' });
    expect(r.html).toMatch(/data-active-when="[^"]*"[^>]*hidden/);
  });
  it('rejects global definitions inside even hidden conditions', () => {
    const r = renderActive(':::when[0]\n```calc\ninput secret = 2\n```\n:::');
    expect(r.messages[0]).toMatchObject({ line: 2, column: 1, message: "calc blocks can't be inside :::when; definitions are global, use if()" });
    expect(r.program?.inputs).toHaveLength(0);
  });
  it('accepts eight nested blocks, rejects nine even while hidden', () => {
    const nested = (n: number) => Array.from({ length: n }, (_, i) => ':'.repeat(n + 2 - i) + 'when[0]').join('\n') + '\nBody\n' + Array.from({ length: n }, (_, i) => ':'.repeat(i + 3)).join('\n');
    expect(renderActive(nested(8)).messages).toEqual([]);
    expect(renderActive(nested(9)).messages).toContainEqual(expect.objectContaining({ message: expect.stringContaining('depth limit (8)'), line: 9 }));
  });
});

it('respects a condition evaluation budget with a positioned failure', () => {
  const r = renderActive(':::when[1+2+3]\nBody\n:::', { limits: { maxSourceLength: 65536, maxDefinitions: 2000, maxSteps: 2, maxDepth: 200 } });
  expect(r.messages[0]).toMatchObject({ line: 1, column: 1, message: expect.stringContaining('too many steps') });
});
