import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { renderActive } from '../packages/remark/src/index';
import type { CompletedQuizAttempt, Mounted, MountOptions } from '../packages/runtime/src/index';

let code: string;
test.beforeAll(async () => {
  const bundle = await build({ configFile: false, build: { write: false,
    lib: { entry: new URL('../packages/runtime/src/index.ts', import.meta.url).pathname, name: 'ActiveRuntime', formats: ['iife'] },
    rollupOptions: { output: { inlineDynamicImports: true } },
  } });
  const outputs = Array.isArray(bundle) ? bundle : [bundle];
  const chunk = outputs.flatMap(output => 'output' in output ? output.output : []).find(output => output.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('No runtime bundle');
  code = chunk.code;
});

type Host = { ActiveRuntime: { mount(root: HTMLElement, options: MountOptions): Mounted };
  live: Mounted; attempts: CompletedQuizAttempt[]; first: string; frozen: boolean };

test('a host receives immutable completed self-checks, never drafts or Retry', async ({ page }) => {
  const source = '```calc\ninput price = 3\n```\n\n:::question{type=number}\nFour shirts?\n\n:answer[4 * price]\n:::\n\n' +
    ':::question{type=single points=2}\nChoose?\n\n::choice[Yes]{correct}\n::choice[No]\n:::\n\n::quiz-submit[Check]\n';
  const rendered = renderActive(source, { quizManifest: true });
  expect(rendered.messages).toEqual([]);
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.setContent('<div id="doc">' + rendered.html + '</div>');
  await page.addScriptTag({ content: code });
  await page.evaluate(quiz => {
    const host = window as unknown as Host;
    host.attempts = [];
    host.live = host.ActiveRuntime.mount(document.querySelector<HTMLElement>('#doc')!, { quiz,
      onQuizAttempt(attempt) {
        host.frozen = Object.isFrozen(attempt) && Object.isFrozen(attempt.responses) && Object.isFrozen(attempt.results[0]);
        host.attempts.push(attempt);
      },
    });
  }, rendered.quiz);
  await page.getByRole('textbox', { name: 'Your answer' }).fill('12');
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  expect(await page.evaluate(() => (window as unknown as Host).attempts.length)).toBe(0);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  const first = await page.evaluate(() => {
    const host = window as unknown as Host; host.first = JSON.stringify(host.attempts[0]);
    return { attempt: host.attempts[0], frozen: host.frozen };
  });
  expect(first.frozen).toBe(true);
  expect(first.attempt).toMatchObject({ version: 1, manifestVersion: 1, seed: null, earned: 3, max: 3,
    responses: [{ questionId: 'question-1', type: 'number', value: 12 },
      { questionId: 'question-2', type: 'single', value: ['choice-1'] }] });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.evaluate(() => (window as unknown as Host).live.session.set('price', 5));
  expect(await page.evaluate(() => (window as unknown as Host).attempts.length)).toBe(1);
  await page.getByRole('textbox', { name: 'Your answer' }).fill('20');
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  expect(await page.evaluate(() => {
    const host = window as unknown as Host;
    return [host.attempts.length, host.attempts[1]!.earned, JSON.stringify(host.attempts[0]) === host.first];
  })).toEqual([2, 3, true]);
  expect(requests).toEqual([]);
});
