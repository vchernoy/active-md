import { expect, it } from 'vitest';
import { shuffleChoiceIds, checkChoiceAnswer, DEFAULT_LIMITS } from '../src/index.js';
const input = Object.freeze(['a', 'b', 'c', 'd']);
it.each([[0, 0, ['c', 'd', 'b', 'a']], [42, 0, ['c', 'b', 'd', 'a']], [42, 3, ['b', 'd', 'c', 'a']], [4294967295, 4294967293, ['b', 'a', 'c', 'd']]] as const)('v1 order seed=%s draw=%s', (seed, draw, ids) => {
  expect(shuffleChoiceIds(input, seed, draw)).toEqual({ kind: 'shuffled', ids });
});
it('returns a reproducible permutation without modifying or aliasing caller arrays', () => {
  for (let seed = 0; seed < 64; seed++) {
    const result = shuffleChoiceIds(input, seed, 2);
    expect(result).toEqual(shuffleChoiceIds(input, seed, 2));
    expect(result.kind).toBe('shuffled');
    if (result.kind === 'shuffled') { expect([...result.ids].sort()).toEqual([...input].sort()); expect(result.ids).not.toBe(input); result.ids.reverse(); }
  }
  expect(input).toEqual(['a', 'b', 'c', 'd']);
});
it('allows empty and single-ID permutations with a fresh result', () => {
  expect(shuffleChoiceIds([], 1)).toEqual({ kind: 'shuffled', ids: [] });
  expect(shuffleChoiceIds(['only'], 1, 4294967295)).toEqual({ kind: 'shuffled', ids: ['only'] });
});
it.each([-1, 0.5, NaN, Infinity, 4294967296, '1', null])('rejects invalid seed %s', value => {
  expect(shuffleChoiceIds(input, value as number)).toMatchObject({ kind: 'invalid', field: 'seed' });
});
it.each([-1, 0.5, NaN, Infinity, 4294967296, '1', null])('rejects invalid draw %s', value => {
  expect(shuffleChoiceIds(input, 1, value as number)).toMatchObject({ kind: 'invalid', field: 'draw' });
});
it('rejects draw overflow rather than wrapping the counter', () => {
  expect(shuffleChoiceIds(input, 1, 4294967294)).toMatchObject({ kind: 'invalid', field: 'draw' });
  expect(shuffleChoiceIds(['a', 'b'], 1, 4294967295).kind).toBe('shuffled');
});
it.each([null, {}, ['a', 'a'], [''], ['a', 1]])('rejects malformed or duplicate IDs %j', value => {
  expect(shuffleChoiceIds(value as readonly string[], 1)).toMatchObject({ kind: 'invalid', field: 'ids' });
});
it('enforces entry and cumulative length budgets before hashing oversized IDs', () => {
  const limit = Array.from({ length: DEFAULT_LIMITS.maxDefinitions }, (_, i) => String(i));
  expect(shuffleChoiceIds(limit, 1).kind).toBe('shuffled');
  expect(shuffleChoiceIds([...limit, 'extra'], 1)).toMatchObject({ kind: 'invalid', field: 'ids' });
  expect(shuffleChoiceIds(['x'.repeat(DEFAULT_LIMITS.maxSourceLength)], 1).kind).toBe('shuffled');
  expect(shuffleChoiceIds(['x'.repeat(40000), 'y'.repeat(40000)], 1)).toMatchObject({ kind: 'invalid', field: 'ids' });
});
it('preserves choice-answer correctness by identity after shuffling', () => {
  const choices = input.map(id => ({ id, correct: id === 'a' || id === 'c' }));
  const result = shuffleChoiceIds(input, 42);
  if (result.kind !== 'shuffled') throw new Error('Invalid fixture');
  expect(checkChoiceAnswer(result.ids.map(id => choices.find(choice => choice.id === id)!), ['a', 'c'], 'multiple')).toEqual({ kind: 'checked', correct: true });
});
