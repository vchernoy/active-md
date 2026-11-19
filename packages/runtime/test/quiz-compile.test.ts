import { expect, it, vi } from 'vitest';
import { createSession, DEFAULT_LIMITS, parse } from '@vchernoy/calc';
import { renderActive } from '@vchernoy/remark-active';
import { compileQuizManifest } from '../src/index.js';
const source = '```calc\ninput seed = 1\ninput topic = 0\nanswer = seed * 2\n```\n\n:::::when[topic]\n:::question{type=number}\n:answer[answer]\n:::\n\n:::question{type=multiple}\n::choice[A]\n:::\n\n::quiz-submit[Check]{seed=seed}\n:::::';
const fixture = () => {
  const rendered = renderActive(source, { quizManifest: true });
  return { manifest: rendered.quiz!, session: createSession(rendered.program!) };
};
it('prepares real compiler output, retaining hidden conditions and live seed dependencies', () => {
  const { manifest, session } = fixture(); const compiled = compileQuizManifest(manifest, session);
  expect(compiled.kind).toBe('compiled'); if (compiled.kind !== 'compiled') throw new Error('Invalid fixture');
  expect([...compiled.answers.keys()]).toEqual(['question-1']);
  expect(compiled.conditions.get('quiz-1')![0]!.evaluate()).toEqual({ kind: 'value', value: 0 });
  expect(compiled.answers.get('question-1')!.evaluate()).toEqual({ kind: 'value', value: 2 });
  session.set('seed', 9); session.set('topic', 1);
  expect(compiled.answers.get('question-1')!.evaluate()).toEqual({ kind: 'value', value: 18 });
  expect(compiled.conditions.get('quiz-1')![0]!.evaluate()).toEqual({ kind: 'value', value: 1 });
  manifest.groups[0]!.questions[0]!.points = 999;
  expect(compiled.manifest.groups[0]!.questions[0]!.points).toBe(1);
});
it('does not evaluate, write, reset or subscribe while preparing; deduplicates expressions', () => {
  const { manifest, session } = fixture(); manifest.groups[0]!.conditions.push(structuredClone(manifest.groups[0]!.conditions[0]!));
  const original = session.compile.bind(session);
  const calls = vi.spyOn(session, 'compile').mockImplementation((...args) => ({ ...original(...args), evaluate: () => { throw new Error('Evaluation during preparation'); } }));
  const set = vi.spyOn(session, 'set'), reset = vi.spyOn(session, 'reset'), subscribe = vi.spyOn(session, 'subscribe');
  expect(compileQuizManifest(manifest, session).kind).toBe('compiled');
  expect(calls).toHaveBeenCalledTimes(2); expect(set).not.toHaveBeenCalled(); expect(reset).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
});
it.each(['removed', 'answer'])('rejects seed binding %s against this session', seed => {
  const { manifest, session } = fixture(); manifest.groups[0]!.seed = seed;
  expect(compileQuizManifest(manifest, session)).toEqual({ kind: 'invalid', reason: 'seed', groupId: 'quiz-1', source: manifest.groups[0]!.source });
});
it('rejects incompatible conditions with their original source location and no partial maps', () => {
  const { manifest, session } = fixture(); manifest.groups[0]!.conditions[0]!.expression = 'unknown';
  expect(compileQuizManifest(manifest, session)).toMatchObject({ kind: 'invalid', reason: 'expression', groupId: 'quiz-1', source: manifest.groups[0]!.conditions[0]!.source });
  expect(compileQuizManifest(manifest, session)).not.toHaveProperty('conditions');
});
it.each(['unknown', '1 +', 'unknownFunction(2)'])('rejects incompatible expected answer %s at its question location', expected => {
  const { manifest, session } = fixture(); const question = manifest.groups[0]!.questions[0]!;
  if (question.type !== 'number') throw new Error('Invalid fixture'); question.expected = expected;
  expect(compileQuizManifest(manifest, session)).toMatchObject({ kind: 'invalid', reason: 'expression', groupId: 'quiz-1', questionId: 'question-1', source: question.source });
});
it('preserves schema failures before touching the session', () => {
  const session = new Proxy({} as ReturnType<typeof createSession>, { get() { throw new Error('Invalid metadata touched session'); } });
  expect(compileQuizManifest({ version: 2, groups: [] }, session)).toEqual({ kind: 'invalid', reason: 'version' });
  expect(compileQuizManifest(null, session)).toEqual({ kind: 'invalid', reason: 'malformed' });
});
it('rejects an erroneous program even when metadata has no expressions', () => {
  const session = createSession(parse([{ id: 'calc', text: 'broken = missing' }]));
  expect(compileQuizManifest({ version: 1, groups: [] }, session)).toEqual({ kind: 'invalid', reason: 'program' });
});
it('accepts empty metadata and unbound groups without adding inputs', () => {
  const { manifest, session } = fixture(); delete manifest.groups[0]!.seed;
  const before = session.inputValues(); expect(compileQuizManifest(manifest, session).kind).toBe('compiled'); expect(session.inputValues()).toEqual(before);
  expect(compileQuizManifest({ version: 1, groups: [] }, session)).toMatchObject({ kind: 'compiled', answers: new Map(), conditions: new Map() });
});
it('uses the current session compiler depth limit', () => {
  const { manifest } = fixture(); const question = manifest.groups[0]!.questions[0]!;
  if (question.type !== 'number') throw new Error('Invalid fixture'); question.expected = '1+'.repeat(20) + '1';
  delete manifest.groups[0]!.seed; manifest.groups[0]!.conditions = [];
  const session = createSession(parse([]), { ...DEFAULT_LIMITS, maxDepth: 2 });
  expect(compileQuizManifest(manifest, session)).toMatchObject({ kind: 'invalid', reason: 'expression', questionId: 'question-1' });
});
