import { describe, expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
import { DEFAULT_LIMITS } from '@vchernoy/calc';

const model = '```calc\nx = 10\ny = x + 5\ninput n = 0 in 0..10\ninput extra = 2\n```\n\n';

describe('proven-false conditional omission', () => {
  it.each(['0', 'x <= 5', 'y < 10', '0 and n', 'n > 20', 'n < 0'])('omits %s and all subtree-only runtime data', condition => {
    const r = renderActive(model + `::::when[${condition}]\nSecret text\n\n:input[extra] :value[extra+123]\n\n$secret={{extra+456}}$\n\n:::when[extra]\nNested secret\n:::\n::::`);
    expect(r.messages).toEqual([]);
    for (const fragment of ['Secret text', 'Nested secret', 'data-active-when', 'data-active-input', 'data-active-value', 'data-active-tex', 'extra+123', 'extra+456', '<math']) expect(r.html).not.toContain(fragment);
    // Calc definitions are global, not scoped to the removed block.
    expect(r.program?.inputs.map(i => i.name)).toEqual(['n', 'extra']);
  });

  it('keeps initially false live conditions and inclusive endpoint comparisons', () => {
    for (const condition of ['n > 5', 'n >= 10', 'extra > 20']) {
      const r = renderActive(model + `:::when[${condition}]\nLive text\n:value[n]\n:::`);
      expect(r.html).toContain('data-active-when=');
      expect(r.html).toContain('hidden');
      expect(r.html).toContain('Live text');
      expect(r.html).toContain('data-active-value="n"');
      expect(r.html).not.toContain('data-active-when-constant');
    }
  });

  it('omits a constant-false child even inside an initially hidden live block', () => {
    const r = renderActive(model + '::::when[n]\n:::when[0]\nDead child\n:value[extra+999]\n:::\n\n:value[n]\n::::');
    expect(r.messages).toEqual([]);
    expect(r.html).toContain('data-active-when="n"');
    expect(r.html).not.toContain('Dead child');
    expect(r.html).not.toContain('extra+999');
    expect(r.html).not.toContain('data-active-when-error="2"');
  });

  it.each(['1/0', 'unknown', 'n >'])('retains erroneous condition %s with positioned diagnostics', condition => {
    const r = renderActive(model + `:::when[${condition}]\nRetained\n:::`);
    expect(r.html).toContain('Retained');
    expect(r.html).toContain('data-active-when-error');
    expect(r.messages).toContainEqual(expect.objectContaining({ severity: 'error', line: 8, column: 1 }));
  });

  it('does not treat a step-budget failure as proof of false', () => {
    const r = renderActive(':::when[1-1]\nRetained\n:::', { limits: { ...DEFAULT_LIMITS, maxSteps: 1 } });
    expect(r.html).toContain('Retained');
    expect(r.messages[0]).toMatchObject({ line: 1, column: 1, message: expect.stringContaining('too many steps') });
  });

  it('retains structural/source errors but never exposes skipped evaluation errors', () => {
    const r = renderActive('::::when[0]\n```calc\ninput secret = 1\n```\n\n:::when[1/0]\n:value[unknown]\n\n$bad={{log(-1)}}$\n:::\n::::');
    expect(r.messages).toEqual([expect.objectContaining({ severity: 'error', line: 2, column: 1, message: expect.stringContaining("calc blocks can't be inside") })]);
    expect(r.html).not.toContain('secret');
    expect(r.html).not.toContain('division by zero');
    expect(r.html).not.toContain('active-when');
  });
});
