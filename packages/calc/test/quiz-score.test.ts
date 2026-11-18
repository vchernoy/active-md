import { expect, it } from 'vitest';
import { scoreQuizGroup, checkAnswer, checkChoiceAnswer, DEFAULT_LIMITS, type QuizScoreInput } from '../src/index.js';
it('defaults to one point per checked question and preserves per-question results', () => {
  expect(scoreQuizGroup([{ correct: true }, { correct: false }, { correct: true }])).toEqual({ kind: 'scored', earned: 2, max: 3,
    results: [{ correct: true, points: 1, earned: 1 }, { correct: false, points: 1, earned: 0 }, { correct: true, points: 1, earned: 1 }] });
});
it('supports explicit fractional/zero weights without inventing a percentage', () => {
  expect(scoreQuizGroup([{ correct: true, points: 0.5 }, { correct: false, points: 2 }, { correct: true, points: 0 }])).toMatchObject({ kind: 'scored', earned: 0.5, max: 2.5 });
  expect(scoreQuizGroup([{ correct: true, points: 0 }, { correct: false, points: 0 }])).toMatchObject({ kind: 'scored', earned: 0, max: 0 });
});
it.each([NaN, Infinity, -Infinity, -1, '2', null])('rejects malformed points %s rather than returning a partial score', points => {
  expect(scoreQuizGroup([{ correct: true }, { correct: false, points: points as number }])).toMatchObject({ kind: 'invalid', field: 'points', index: 1 });
});
it.each([undefined, null, {}, [], { correct: 1 }, { correct: 'true' }])('requires checked boolean correctness %j', result => {
  expect(scoreQuizGroup([result as QuizScoreInput])).toMatchObject({ kind: 'invalid', field: 'correct', index: 0 });
});
it.each([[], null, {}, new Array(DEFAULT_LIMITS.maxDefinitions + 1)])('rejects empty/malformed/oversized groups %j', value => {
  expect(scoreQuizGroup(value as readonly QuizScoreInput[])).toMatchObject({ kind: 'invalid', field: 'results' });
});
it('accepts the exact result limit and finite extreme weights', () => {
  expect(scoreQuizGroup(Array.from({ length: DEFAULT_LIMITS.maxDefinitions }, () => ({ correct: true })))).toMatchObject({ kind: 'scored', earned: 2000, max: 2000 });
  expect(scoreQuizGroup([{ correct: true, points: Number.MAX_VALUE }])).toMatchObject({ kind: 'scored', earned: Number.MAX_VALUE, max: Number.MAX_VALUE });
});
it('rejects overflowing maximum totals even when every response is incorrect', () => {
  expect(scoreQuizGroup([{ correct: false, points: Number.MAX_VALUE }, { correct: false, points: Number.MAX_VALUE }])).toMatchObject({ kind: 'invalid', field: 'total', index: 1 });
});
it('does not mutate callers or alias returned result rows across calls', () => {
  const input = Object.freeze([Object.freeze({ correct: true, points: 3 })]);
  const result = scoreQuizGroup(input);
  if (result.kind !== 'scored') throw new Error('Invalid fixture');
  result.results[0]!.points = 100; result.results.length = 0;
  expect(input[0]!.points).toBe(3);
  expect(scoreQuizGroup(input)).toMatchObject({ kind: 'scored', earned: 3, max: 3, results: [{ correct: true, points: 3, earned: 3 }] });
});
it('aggregates successful numeric and choice checks without grading raw responses itself', () => {
  const number = checkAnswer(10, 10), choice = checkChoiceAnswer([{ id: 'a', correct: true }], ['a'], 'single');
  if (number.kind !== 'checked' || choice.kind !== 'checked') throw new Error('Invalid fixture');
  expect(scoreQuizGroup([{ correct: number.correct }, { correct: choice.correct, points: 2 }])).toMatchObject({ kind: 'scored', earned: 3, max: 3 });
});
