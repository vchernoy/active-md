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
