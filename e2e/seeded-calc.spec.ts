import { expect, test } from '@playwright/test';

test('seeded calc vectors and same-session dependencies agree in browser engines', async ({ page }) => {
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
    const program = api.parse([{ id: 'model', text: 'input seed = 1\ninput other = 0\na = rand(seed)\nb = a * 10\nc = randInt(seed, 3, 12, 1)' }]);
    const session = api.createSession(program);
    const binding = session.compile('b + c');
    const first = binding.evaluate(); session.set('other', 9);
    const unchanged = binding.evaluate(); session.set('seed', 42);
    return { messages: program.diagnostics, first, unchanged, updated: binding.evaluate(),
      direct: session.get('a'), integer: session.get('c'),
      upper: session.compile('randInt(857579651, -2147483648, 2147483647)').evaluate(),
      error: session.compile('rand(-1)').evaluate() };
  });
  expect(result.messages).toEqual([]);
  expect(result.first).toEqual(result.unchanged);
  expect(result.updated).not.toEqual(result.first);
  expect(result.direct).toEqual({ kind: 'value', value: 142593372 / 4294967296 });
  expect(result.integer).toEqual({ kind: 'value', value: 5 });
  expect(result.updated).toEqual({ kind: 'value', value: (142593372 / 4294967296) * 10 + 5 });
  expect(result.upper).toEqual({ kind: 'value', value: 2147483647 });
  expect(result.error).toMatchObject({ kind: 'error', span: { column: 1 } });
});
