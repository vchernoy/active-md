import { expect, it, vi } from 'vitest';
import { createSession } from '@vchernoy/calc';
import { renderActive } from '@vchernoy/remark-active';
import { checkQuizGroup, compileQuizManifest, type QuizResponses } from '../src/index.js';
const source = '```calc\ninput topic = 1\ninput seed = 10\n```\n\n:::::when[topic]\n:::question{type=number points=2}\n:answer[seed]{tolerance=0.1 relative}\n:::\n\n:::question{type=single points=3}\n::choice[A]{correct}\n\n::choice[B]{correct}\n\n::choice[C]\n:::\n\n:::question{type=multiple points=0.5}\n::choice[A]{correct}\n\n::choice[B]\n\n::choice[C]{correct}\n:::\n\n::quiz-submit[Check]{seed=seed}\n:::::';
const fixture = () => {
  const rendered = renderActive(source, { quizManifest: true }); const session = createSession(rendered.program!);
  const prepared = compileQuizManifest(rendered.quiz, session); if (prepared.kind !== 'compiled') throw new Error('Invalid fixture');
  return { session, prepared };
};
const correct = (): Map<string, number | readonly string[]> => new Map<string, number | readonly string[]>([['question-1', 11], ['question-2', ['choice-2']], ['question-3', ['choice-3', 'choice-1']]]);
it('checks all answer modes and combines fractional weights in source order', () => {
  const { prepared } = fixture();
  expect(checkQuizGroup(prepared, 'quiz-1', correct())).toEqual({ kind: 'checked', groupId: 'quiz-1', earned: 5.5, max: 5.5,
    results: [{ questionId: 'question-1', correct: true, points: 2, earned: 2 }, { questionId: 'question-2', correct: true, points: 3, earned: 3 }, { questionId: 'question-3', correct: true, points: 0.5, earned: 0.5 }] });
});
it('valid incorrect and unanswered responses produce scores, not invalid results', () => {
  const { prepared } = fixture();
  expect(checkQuizGroup(prepared, 'quiz-1', new Map())).toMatchObject({ kind: 'checked', earned: 0, max: 5.5 });
  const values = correct(); values.set('question-1', 12); values.set('question-2', ['choice-3']); values.set('question-3', ['choice-1']);
  expect(checkQuizGroup(prepared, 'quiz-1', values)).toMatchObject({ kind: 'checked', earned: 0, max: 5.5 });
});
it('hidden groups short-circuit before looking at answers or responses', () => {
  const { prepared, session } = fixture(); session.set('topic', 0);
  vi.spyOn(prepared.answers.get('question-1')!, 'evaluate').mockImplementation(() => { throw new Error('Hidden answer evaluated'); });
  const values = new Proxy({} as QuizResponses, { get() { throw new Error('Hidden response inspected'); } });
  expect(checkQuizGroup(prepared, 'quiz-1', values)).toEqual({ kind: 'hidden', groupId: 'quiz-1' });
});
it('conditions short-circuit outer-to-inner; errors are invalid rather than hidden', () => {
  const { prepared } = fixture(); const conditions = prepared.conditions.get('quiz-1')!;
  vi.spyOn(conditions[0]!, 'evaluate').mockReturnValue({ kind: 'error', message: 'No condition value' });
  expect(checkQuizGroup(prepared, 'quiz-1', correct())).toEqual({ kind: 'invalid', groupId: 'quiz-1', reason: 'condition' });
  vi.spyOn(conditions[0]!, 'evaluate').mockReturnValue({ kind: 'value', value: NaN });
  expect(checkQuizGroup(prepared, 'quiz-1', correct())).toMatchObject({ kind: 'invalid', reason: 'condition' });
});
it('uses current expected values but returns detached point-in-time scores', () => {
  const { prepared, session } = fixture(); const values = correct(); const checked = checkQuizGroup(prepared, 'quiz-1', values);
  session.set('seed', 20); values.set('question-2', []); prepared.manifest.groups[0]!.questions[0]!.points = 7;
  expect(checked).toMatchObject({ kind: 'checked', earned: 5.5, max: 5.5 });
  expect(checkQuizGroup(prepared, 'quiz-1', correct())).toMatchObject({ kind: 'checked', earned: 3.5, max: 10.5 });
});
it.each([NaN, Infinity, ['choice-1']].map(value => [value] as const))('rejects malformed numeric response %j', value => {
  const { prepared } = fixture(); const values = correct(); values.set('question-1', value);
  expect(checkQuizGroup(prepared, 'quiz-1', values)).toMatchObject({ kind: 'invalid', reason: 'response', questionId: 'question-1' });
});
it.each([['unknown'], ['choice-1', 'choice-1'], ['choice-1', 'choice-2'], 3].map(value => [value] as const))('rejects malformed single selection %j', value => {
  const { prepared } = fixture(); const values = correct(); values.set('question-2', value);
  expect(checkQuizGroup(prepared, 'quiz-1', values)).toMatchObject({ kind: 'invalid', reason: 'response', questionId: 'question-2' });
});
it('rejects foreign question IDs and unknown groups', () => {
  const { prepared } = fixture(); const values = correct(); values.delete('question-1'); values.set('other', 1);
  expect(checkQuizGroup(prepared, 'quiz-1', values)).toMatchObject({ kind: 'invalid', reason: 'response' });
  expect(checkQuizGroup(prepared, 'unknown', correct())).toEqual({ kind: 'invalid', reason: 'group', groupId: 'unknown' });
});
it('does not silently grade expected-evaluation failures incorrect', () => {
  const { prepared } = fixture(); vi.spyOn(prepared.answers.get('question-1')!, 'evaluate').mockReturnValue({ kind: 'error', message: 'Invalid expected answer' });
  expect(checkQuizGroup(prepared, 'quiz-1', new Map())).toMatchObject({ kind: 'invalid', reason: 'answer', questionId: 'question-1' });
});
it('rejects missing compiled configuration without partial scores', () => {
  const { prepared } = fixture(); (prepared.answers as Map<string, unknown>).delete('question-1');
  const result = checkQuizGroup(prepared, 'quiz-1', correct());
  expect(result).toMatchObject({ kind: 'invalid', reason: 'configuration' }); expect(result).not.toHaveProperty('earned');
});
it('checking leaves inputs, responses and subscriptions untouched', () => {
  const { prepared, session } = fixture(); const values = correct(), before = structuredClone(values), inputs = session.inputValues();
  const set = vi.spyOn(session, 'set'), reset = vi.spyOn(session, 'reset'), subscribe = vi.spyOn(session, 'subscribe');
  checkQuizGroup(prepared, 'quiz-1', values); checkQuizGroup(prepared, 'quiz-1', values);
  expect(values).toEqual(before); expect(session.inputValues()).toEqual(inputs);
  expect(set).not.toHaveBeenCalled(); expect(reset).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
});
it('does not evaluate an inner condition after a hidden outer condition', () => {
  const { prepared, session } = fixture(); const conditions = prepared.conditions.get('quiz-1')!;
  const inner = session.compile('1 / 0'); const evaluate = vi.spyOn(inner, 'evaluate');
  (conditions as typeof inner[]).push(inner); prepared.manifest.groups[0]!.conditions.push({ expression: '1 / 0', source: { line: 2, column: 1 } });
  session.set('topic', 0);
  expect(checkQuizGroup(prepared, 'quiz-1', correct())).toEqual({ kind: 'hidden', groupId: 'quiz-1' }); expect(evaluate).not.toHaveBeenCalled();
});
it('permits a multiple-choice empty accepted set and zero-point questions', () => {
  const { prepared } = fixture(); const questions = prepared.manifest.groups[0]!.questions;
  const multiple = questions[2]!; if (multiple.type === 'number') throw new Error('Invalid fixture');
  multiple.choices.forEach(choice => { choice.correct = false; }); multiple.points = 0;
  const values = correct(); values.delete('question-3');
  const checked = checkQuizGroup(prepared, 'quiz-1', values);
  expect(checked).toMatchObject({ kind: 'checked', earned: 5, max: 5 });
  if (checked.kind !== 'checked') throw new Error('Invalid fixture');
  expect(checked.results[2]).toEqual({ questionId: 'question-3', correct: true, points: 0, earned: 0 });
});
