import { expect, it } from 'vitest';
import { checkChoiceAnswer, DEFAULT_LIMITS, type ChoiceOption, type ChoiceMode } from '../src/index.js';
const choices = [{ id: 'a', correct: true }, { id: 'b', correct: false }, { id: 'c', correct: true }];
it.each([[['a'], true], [['c'], true], [['b'], false], [[], false]] as const)('single selection %j', (given, correct) => {
  expect(checkChoiceAnswer(choices, given, 'single')).toEqual({ kind: 'checked', correct });
});
it.each([[['a', 'c'], true], [['c', 'a'], true], [['a'], false], [['a', 'b', 'c'], false], [[], false]] as const)('multiple selection %j', (given, correct) => {
  expect(checkChoiceAnswer(choices, given, 'multiple')).toEqual({ kind: 'checked', correct });
});
it('permits an empty correct set only for multiple selection', () => {
  const none = [{ id: 'a', correct: false }];
  expect(checkChoiceAnswer(none, [], 'multiple')).toEqual({ kind: 'checked', correct: true });
  expect(checkChoiceAnswer(none, ['a'], 'multiple')).toEqual({ kind: 'checked', correct: false });
  expect(checkChoiceAnswer(none, [], 'single')).toMatchObject({ kind: 'invalid', field: 'choices' });
});
it('preserves correctness under presentation/selection reorder without mutating callers', () => {
  const frozen = Object.freeze(choices.map(choice => Object.freeze({ ...choice })));
  const given = Object.freeze(['c', 'a']);
  expect(checkChoiceAnswer(frozen, given, 'multiple')).toEqual({ kind: 'checked', correct: true });
  expect(checkChoiceAnswer([...frozen].reverse(), given, 'multiple')).toEqual({ kind: 'checked', correct: true });
  expect(given).toEqual(['c', 'a']);
});
it.each([[], null, {}, [null], [{ id: '', correct: true }], [{ id: 'a', correct: 'true' }], [{ id: 'a', correct: true }, { id: 'a', correct: false }]])('rejects invalid choice metadata %j', value => {
  expect(checkChoiceAnswer(value as readonly ChoiceOption[], [], 'multiple')).toMatchObject({ kind: 'invalid', field: 'choices' });
});
it.each([null, {}, ['missing'], ['a', 'a'], [1], [true]])('rejects malformed/unknown/duplicate selections %j', value => {
  expect(checkChoiceAnswer(choices, value as readonly string[], 'multiple')).toMatchObject({ kind: 'invalid', field: 'given' });
});
it('rejects several selections for single mode and unsupported modes', () => {
  expect(checkChoiceAnswer(choices, ['a', 'c'], 'single')).toMatchObject({ kind: 'invalid', field: 'given' });
  expect(checkChoiceAnswer(choices, ['a'], 'other' as ChoiceMode)).toMatchObject({ kind: 'invalid', field: 'mode' });
});
it('uses exact case-sensitive identities and safely handles prototype-shaped names', () => {
  expect(checkChoiceAnswer([{ id: '__proto__', correct: true }, { id: 'A', correct: false }], ['__proto__'], 'single')).toEqual({ kind: 'checked', correct: true });
  expect(checkChoiceAnswer([{ id: 'A', correct: true }], ['a'], 'single')).toMatchObject({ kind: 'invalid', field: 'given' });
});
it('bounds entry counts and cumulative ID lengths before hashing IDs', () => {
  expect(checkChoiceAnswer(Array(DEFAULT_LIMITS.maxDefinitions + 1).fill({ id: 'a', correct: true }), [], 'multiple')).toMatchObject({ kind: 'invalid', field: 'choices' });
  expect(checkChoiceAnswer(choices, Array(DEFAULT_LIMITS.maxDefinitions + 1).fill('a'), 'multiple')).toMatchObject({ kind: 'invalid', field: 'given' });
  expect(checkChoiceAnswer([{ id: 'x'.repeat(DEFAULT_LIMITS.maxSourceLength + 1), correct: true }], [], 'multiple')).toMatchObject({ kind: 'invalid', field: 'choices' });
  expect(checkChoiceAnswer(choices, ['x'.repeat(DEFAULT_LIMITS.maxSourceLength + 1)], 'multiple')).toMatchObject({ kind: 'invalid', field: 'given' });
});
it('accepts exact entry/length budgets and rejects cumulative ID overflow', () => {
  const atLimit = Array.from({ length: DEFAULT_LIMITS.maxDefinitions }, (_, i) => ({ id: String(i), correct: true }));
  expect(checkChoiceAnswer(atLimit, atLimit.map(choice => choice.id), 'multiple')).toEqual({ kind: 'checked', correct: true });
  const id = 'x'.repeat(DEFAULT_LIMITS.maxSourceLength);
  expect(checkChoiceAnswer([{ id, correct: true }], [id], 'single')).toEqual({ kind: 'checked', correct: true });
  expect(checkChoiceAnswer([{ id: 'x'.repeat(40000), correct: true }, { id: 'y'.repeat(40000), correct: false }], [], 'multiple')).toMatchObject({ kind: 'invalid', field: 'choices' });
});
