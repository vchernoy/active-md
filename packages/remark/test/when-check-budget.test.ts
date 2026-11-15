import { expect, it } from 'vitest';
import { parse } from '@vchernoy/calc';
import { checkWhenControls } from '../src/when-check.js';
it('reuses a long dependency chain across repeated conditions', () => {
  const p = parse([{ id: 'a', text: 'input x = 1\n' + Array.from({ length: 999 }, (_, i) => `v${i} = ${i ? `v${i - 1}` : 'x'}`).join('\n') }]);
  const blocks = Array.from({ length: 1000 }, () => ({ expression: 'v998', deps: new Set(['v998']) }));
  // A full chain walk per block would exceed this budget; shared closures do not.
  const r = checkWhenControls(p, blocks, [{ name: 'x', ancestors: [999] }], 15000);
  expect(r).toHaveLength(1);
  expect(r[0]!.message).toContain('x can hide its own only control');
  expect(checkWhenControls(p, blocks, [], 1)).toEqual([]);
  expect(checkWhenControls(p, blocks, [{ name: 'x', ancestors: [999] }], 10)[0]!.message).toContain('too many steps');
});
