import { expect, test } from '@playwright/test';
import type { ViteDevServer } from 'vite';
import { createPlaygroundServer } from './playground-server';
let server: ViteDevServer;
let url: string;
test.beforeAll(async () => { server = await createPlaygroundServer(); await server.listen(); url = server.resolvedUrls!.local[0]!; });
test.afterAll(async () => { await server?.close(); });
test('opt-in quiz metadata preserves hidden source groups without changing HTML or seed defaults', async ({ page }) => {
  await page.goto(url);
  const path = '/@fs' + new URL('../packages/remark/src/index.ts', import.meta.url).pathname;
  const source = '```calc\ninput seed = 1\n```\n\n:::::when[0]\n:::question{type=number points=0.5}\n:answer[2*3*4]{tolerance=0.1 relative}\n:::\n\n::quiz-submit[Check]{seed=seed}\n:::::';
  const result = await page.evaluate(async ({ path, source }) => {
    const { renderActive } = await import(path) as typeof import('../packages/remark/src/index.js');
    const plain = renderActive(source), prepared = renderActive(source, { quizManifest: true });
    return { quiz: prepared.quiz, errors: prepared.messages, htmlSame: plain.html === prepared.html,
      defaultHasQuiz: Object.hasOwn(plain, 'quiz'), seed: prepared.program?.inputs[0]?.default,
      invalidOmitted: !Object.hasOwn(renderActive(source.replace('points=0.5', 'points=-1'), { quizManifest: true }), 'quiz') };
  }, { path, source });
  expect(result).toMatchObject({ errors: [], htmlSame: true, defaultHasQuiz: false, seed: 1, invalidOmitted: true,
    quiz: { version: 1, groups: [{ id: 'quiz-1', seed: 'seed', conditions: [{ expression: '0', source: { line: 5, column: 1 } }],
      questions: [{ id: 'question-1', type: 'number', points: 0.5, expected: '2*3*4', tolerance: 0.1, relative: true }] }] } });
});
