import { expect, test } from '@playwright/test';

test('numeric answer tolerances and overflow behavior agree in browser engines', async ({ page }) => {
  const { build } = await import('vite');
  const bundle = await build({ configFile: false, build: { write: false,
    lib: { entry: new URL('../packages/calc/src/index.ts', import.meta.url).pathname, name: 'Calc', formats: ['iife'] },
  } });
  const outputs = Array.isArray(bundle) ? bundle : [bundle];
  const code = outputs.flatMap(output => 'output' in output ? output.output : []).find(output => output.type === 'chunk');
  if (!code || code.type !== 'chunk') throw new Error('No calc browser bundle');
  await page.setContent('<p>Seeded calc fixture</p>');
  await page.addScriptTag({ content: code.code });
  const result = await page.evaluate(() => {
    const api = (window as unknown as { Calc: typeof import('../packages/calc/src/index') }).Calc;
    const max = Number.MAX_VALUE;
    return [api.checkAnswer(100, 125, { tolerance: 0.25, relative: true }),
      api.checkAnswer(max, -max, { tolerance: 1.5, relative: true }),
      api.checkAnswer(max, -max, { tolerance: 2, relative: true }),
      api.checkAnswer(0, 1, { tolerance: 10, relative: true }),
      api.checkAnswer(2, NaN), api.checkAnswer(0.1 + 0.2, 0.3),
      api.checkAnswer(0.1 + 0.2, 0.3, { tolerance: 1e-15 })];
  });
  expect(result).toEqual([{ kind: 'checked', correct: true }, { kind: 'checked', correct: false },
    { kind: 'checked', correct: true }, { kind: 'checked', correct: false },
    { kind: 'invalid', field: 'given', message: 'response must be a finite number' },
    { kind: 'checked', correct: false }, { kind: 'checked', correct: true }]);
});
