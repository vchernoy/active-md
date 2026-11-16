import { expect, it } from 'vitest';
import { checkAnswer } from '../src/index.js';
it.each([[2, 2, true], [2, 3, false], [0, -0, true], [0.1 + 0.2, 0.3, false], [Number.MIN_VALUE, 0, false]])(
  'exact checking expected=%s given=%s', (expected, given, correct) => {
    expect(checkAnswer(expected!, given!)).toEqual({ kind: 'checked', correct });
  });
it.each([[10, 12, 2, true], [10, 12.0001, 2, false], [-10, -12, 2, true], [0, 0.5, 0.5, true], [0, -0.5, 0.5, true]])(
  'absolute tolerance expected=%s given=%s tolerance=%s', (expected, given, tolerance, correct) => {
    expect(checkAnswer(expected!, given!, { tolerance: tolerance! })).toEqual({ kind: 'checked', correct });
  });
it.each([[100, 125, 0.25, true], [-100, -125, 0.25, true], [100, 125.001, 0.25, false], [0, 1, 10, false], [0, 0, 10, true], [Number.MIN_VALUE, 0, 1, true], [Number.MIN_VALUE, 0, 0, false]])(
  'relative tolerance expected=%s given=%s tolerance=%s', (expected, given, tolerance, correct) => {
    expect(checkAnswer(expected!, given!, { tolerance: tolerance!, relative: true })).toEqual({ kind: 'checked', correct });
  });
it('handles subtraction and scaled-bound overflow without accepting an infinite threshold', () => {
  const max = Number.MAX_VALUE;
  expect(checkAnswer(max, -max, { tolerance: max })).toEqual({ kind: 'checked', correct: false });
  expect(checkAnswer(max, -max, { tolerance: 1.5, relative: true })).toEqual({ kind: 'checked', correct: false });
  expect(checkAnswer(max, -max, { tolerance: 2, relative: true })).toEqual({ kind: 'checked', correct: true });
  expect(checkAnswer(Number.MIN_VALUE, max, { tolerance: max, relative: true })).toEqual({ kind: 'checked', correct: false });
});
it.each([NaN, Infinity, -Infinity, '2' as unknown as number, null as unknown as number, undefined as unknown as number])('rejects nonfinite or nonnumeric operands %s', value => {
  expect(checkAnswer(value, 2)).toMatchObject({ kind: 'invalid', field: 'expected' });
  expect(checkAnswer(2, value)).toMatchObject({ kind: 'invalid', field: 'given' });
});
it.each([-1, NaN, Infinity, '1' as unknown as number, null as unknown as number])('validates tolerance before checking even equal answers: %s', tolerance => {
  expect(checkAnswer(2, 2, { tolerance })).toMatchObject({ kind: 'invalid', field: 'tolerance' });
});
it('rejects a nonboolean relative option and does not modify caller options', () => {
  expect(checkAnswer(2, 2, { relative: 1 as unknown as boolean })).toMatchObject({ kind: 'invalid', field: 'relative' });
  const options = Object.freeze({ tolerance: 0.25, relative: true });
  expect(checkAnswer(100, 125, options)).toEqual({ kind: 'checked', correct: true });
  expect(options).toEqual({ tolerance: 0.25, relative: true });
});
