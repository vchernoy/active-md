import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
let server: ViteDevServer;
let url: string;
test.beforeAll(async () => {
  server = await createPlaygroundServer();
  await server.listen(); url = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => { await server?.close(); });
test('pure choice checker works in browsers with stable identities after reorder', async ({ page }) => {
  await page.goto(url);
  const modulePath = '/@fs' + new URL('../packages/calc/src/index.ts', import.meta.url).pathname;
  const result = await page.evaluate(async path => {
    const { checkChoiceAnswer } = await import(path) as typeof import('../packages/calc/src/index.js');
    const choices = Object.freeze([Object.freeze({ id: 'a', correct: true }), Object.freeze({ id: 'b', correct: false }), Object.freeze({ id: 'c', correct: true })]);
    return [checkChoiceAnswer(choices, ['a'], 'single'), checkChoiceAnswer([...choices].reverse(), ['c'], 'single'),
      checkChoiceAnswer(choices, ['c', 'a'], 'multiple'), checkChoiceAnswer([...choices].reverse(), ['a', 'c'], 'multiple'),
      checkChoiceAnswer([{ id: 'a', correct: false }], [], 'multiple'), checkChoiceAnswer(choices, ['a', 'b'], 'multiple'),
      checkChoiceAnswer(choices, ['unknown'], 'single')];
  }, modulePath);
  expect(result).toEqual([{ kind: 'checked', correct: true }, { kind: 'checked', correct: true },
    { kind: 'checked', correct: true }, { kind: 'checked', correct: true }, { kind: 'checked', correct: true },
    { kind: 'checked', correct: false }, { kind: 'invalid', field: 'given', message: 'submitted IDs must be known and unique' }]);
});

test('seeded choice ordering has identical v1 vectors across browsers', async ({ page }) => {
  await page.goto(url);
  const modulePath = '/@fs' + new URL('../packages/calc/src/index.ts', import.meta.url).pathname;
  const result = await page.evaluate(async path => {
    const { shuffleChoiceIds } = await import(path) as typeof import('../packages/calc/src/index.js');
    const ids = Object.freeze(['a', 'b', 'c', 'd']);
    return [shuffleChoiceIds(ids, 0), shuffleChoiceIds(ids, 42), shuffleChoiceIds(ids, 42, 3),
      shuffleChoiceIds(ids, 4294967295, 4294967293), shuffleChoiceIds([], 1),
      shuffleChoiceIds(ids, 1, 4294967294)];
  }, modulePath);
  expect(result).toEqual([{ kind: 'shuffled', ids: ['c', 'd', 'b', 'a'] },
    { kind: 'shuffled', ids: ['c', 'b', 'd', 'a'] }, { kind: 'shuffled', ids: ['b', 'd', 'c', 'a'] },
    { kind: 'shuffled', ids: ['b', 'a', 'c', 'd'] }, { kind: 'shuffled', ids: [] },
    { kind: 'invalid', field: 'draw', message: 'draw sequence must fit unsigned 32-bit integers' }]);
});

test('pure quiz group scoring aggregates checked answers in browsers', async ({ page }) => {
  await page.goto(url);
  const modulePath = '/@fs' + new URL('../packages/calc/src/index.ts', import.meta.url).pathname;
  const result = await page.evaluate(async path => {
    const { scoreQuizGroup, checkAnswer, checkChoiceAnswer } = await import(path) as typeof import('../packages/calc/src/index.js');
    const number = checkAnswer(10, 10), choice = checkChoiceAnswer([{ id: 'a', correct: true }], ['a'], 'single');
    if (number.kind !== 'checked' || choice.kind !== 'checked') throw new Error('Invalid fixture');
    return [scoreQuizGroup(Object.freeze([Object.freeze({ correct: number.correct }), Object.freeze({ correct: choice.correct, points: 2 }), Object.freeze({ correct: false, points: 0 })])),
      scoreQuizGroup([{ correct: false, points: Number.MAX_VALUE }, { correct: false, points: Number.MAX_VALUE }])];
  }, modulePath);
  expect(result).toEqual([{ kind: 'scored', earned: 3, max: 3, results: [{ correct: true, points: 1, earned: 1 }, { correct: true, points: 2, earned: 2 }, { correct: false, points: 0, earned: 0 }] },
    { kind: 'invalid', field: 'total', index: 1, message: 'quiz point totals must remain finite' }]);
});
