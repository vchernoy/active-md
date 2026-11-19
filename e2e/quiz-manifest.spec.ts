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

test('hidden labelless when paragraphs cannot become quiz conditions', async ({ page }) => {
  await page.goto(url);
  const path = '/@fs' + new URL('../packages/remark/src/index.ts', import.meta.url).pathname;
  const source = '::::::when[0]\n:::::when\n1\n\n:::question{type=number}\n:answer[10]\n:::\n\n::quiz-submit[Check]\n:::::\n::::::';
  const result = await page.evaluate(async ({ path, source }) => {
    const { renderActive } = await import(path) as typeof import('../packages/remark/src/index.js');
    const invalid = renderActive(source, { quizManifest: true });
    const valid = renderActive(source.replace(':::::when\n1', ':::::when[1]\n1'), { quizManifest: true });
    return { invalidHasQuiz: Object.hasOwn(invalid, 'quiz'), errors: invalid.messages,
      validErrors: valid.messages, conditions: valid.quiz?.groups[0]?.conditions.map(condition => condition.expression) };
  }, { path, source });
  expect(result.invalidHasQuiz).toBe(false);
  expect(result.errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining('quiz condition:'), line: 2, column: 1 }));
  expect(result.validErrors).toEqual([]);
  expect(result.conditions).toEqual(['0', '1']);
});

test('runtime inspection copies compiler metadata and rejects tampering without DOM changes', async ({ page }) => {
  await page.goto(url);
  const remarkPath = '/@fs' + new URL('../packages/remark/src/index.ts', import.meta.url).pathname;
  const runtimePath = '/@fs' + new URL('../packages/runtime/src/index.ts', import.meta.url).pathname;
  const result = await page.evaluate(async ({ remarkPath, runtimePath }) => {
    const { renderActive } = await import(remarkPath) as typeof import('../packages/remark/src/index.js');
    const { inspectQuizManifest } = await import(runtimePath) as typeof import('../packages/runtime/src/index.js');
    const input = renderActive(':::question{type=number}\n:answer[10]\n:::\n\n::quiz-submit[Check]', { quizManifest: true }).quiz!;
    const before = document.body.innerHTML;
    const checked = inspectQuizManifest(input);
    if (checked.kind !== 'valid') throw new Error('Invalid fixture');
    input.groups[0]!.questions[0]!.points = 99;
    const version = inspectQuizManifest({ ...input, version: 2 });
    input.groups[0]!.questions.push(input.groups[0]!.questions[0]!);
    return { independentPoints: checked.manifest.groups[0]!.questions[0]!.points,
      version, duplicate: inspectQuizManifest(input), unchanged: document.body.innerHTML === before };
  }, { remarkPath, runtimePath });
  expect(result).toEqual({ independentPoints: 1, version: { kind: 'invalid', reason: 'version' }, duplicate: { kind: 'invalid', reason: 'malformed' }, unchanged: true });
});

test('quiz compilation binds expressions to the live session without changing inputs or DOM', async ({ page }) => {
  await page.goto(url);
  const paths = { remark: '/@fs' + new URL('../packages/remark/src/index.ts', import.meta.url).pathname,
    runtime: '/@fs' + new URL('../packages/runtime/src/index.ts', import.meta.url).pathname,
    calc: '/@fs' + new URL('../packages/calc/src/index.ts', import.meta.url).pathname };
  const result = await page.evaluate(async paths => {
    const { renderActive } = await import(paths.remark) as typeof import('../packages/remark/src/index.js');
    const { compileQuizManifest } = await import(paths.runtime) as typeof import('../packages/runtime/src/index.js');
    const { createSession } = await import(paths.calc) as typeof import('../packages/calc/src/index.js');
    const source = '```calc\ninput seed = 1\ninput topic = 0\nexpected = seed * 2\n```\n\n:::::when[topic]\n:::question{type=number}\n:answer[expected]\n:::\n\n::quiz-submit[Check]{seed=seed}\n:::::';
    const rendered = renderActive(source, { quizManifest: true }); const session = createSession(rendered.program!);
    const before = document.body.innerHTML, inputs = [...session.inputValues()];
    const compiled = compileQuizManifest(rendered.quiz, session);
    if (compiled.kind !== 'compiled') throw new Error('Invalid compiler output');
    const answer = compiled.answers.get('question-1')!, condition = compiled.conditions.get('quiz-1')![0]!;
    const initial = { answer: answer.evaluate(), condition: condition.evaluate(), untouched: JSON.stringify(inputs) === JSON.stringify([...session.inputValues()]) };
    session.set('seed', 7); session.set('topic', 1);
    const question = rendered.quiz!.groups[0]!.questions[0]!;
    if (question.type !== 'number') throw new Error('Invalid fixture'); question.expected = 'unknown';
    return { initial, updated: { answer: answer.evaluate(), condition: condition.evaluate() },
      incompatible: compileQuizManifest(rendered.quiz, session).kind, domSame: before === document.body.innerHTML };
  }, paths);
  expect(result).toEqual({ initial: { answer: { kind: 'value', value: 2 }, condition: { kind: 'value', value: 0 }, untouched: true },
    updated: { answer: { kind: 'value', value: 14 }, condition: { kind: 'value', value: 1 } }, incompatible: 'invalid', domSame: true });
});
