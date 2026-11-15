import { describe, expect, it } from 'vitest';
import { inputWidth } from '../src/input-width.js';

describe('number control width', () => {
  it.each([
    ['1', '50', '10', '1', 3],
    ['0', '100', '10', '1', 4],
    ['0', '10000000', '10000', '1', 9],
    ['-10', '10', '0', '0.01', 7],
    ['0', '1', '0.125', 'any', 6],
    ['0', '1', '0', '1e-3', 6],
    ['0', '2', '12345', '1', 6],
    ['-1000000000000', '1000000000000', '0', '1', 12],
    ['', '', '10', '1', 8],
    ['0', '', '10', '1', 8],
    ['bad', '100', '10', '1', 8],
  ])('%s..%s starting %s step %s => %s', (min, max, value, step, width) => {
    expect(inputWidth(min, max, value, step)).toBe(width);
  });
});
