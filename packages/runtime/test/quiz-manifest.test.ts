import { expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { inspectQuizManifest } from '../src/index.js';
const source = '```calc\ninput seed = 1\ninput topic = 0\n```\n\n:::::when[topic]\n:::question{type=number points=0.5}\n:answer[seed+1]{tolerance=0.1 relative}\n:::\n\n:::question{type=single}\n::choice[**A**]{correct}\n\n::choice[B]\n:::\n\n::quiz-submit[Check]{seed=seed}\n:::::';
const fixture = () => renderActive(source, { quizManifest: true }).quiz!;
const change = (path: readonly (string | number)[], value: unknown) => {
  const manifest = fixture(); let node: unknown = manifest;
  for (const key of path.slice(0, -1)) node = (node as Record<string | number, unknown>)[key];
  (node as Record<string | number, unknown>)[path[path.length - 1]!] = value;
  return manifest;
};
it('accepts actual compiler metadata and copies every nested structure independently', () => {
  const input = fixture(), checked = inspectQuizManifest(input);
  expect(checked.kind).toBe('valid');
  if (checked.kind !== 'valid') throw new Error('Invalid fixture');
  expect(checked.manifest).toEqual(input);
  input.groups[0]!.questions[0]!.points = 99;
  input.groups[0]!.conditions[0]!.source.line = 99;
  checked.manifest.groups[0]!.questions[1]!.points = 8;
  expect(checked.manifest.groups[0]!.questions[0]!.points).toBe(0.5);
  expect(checked.manifest.groups[0]!.conditions[0]!.source.line).not.toBe(99);
  expect(input.groups[0]!.questions[1]!.points).toBe(1);
});
it('accepts empty documents and multiple-choice empty correct sets', () => {
  expect(inspectQuizManifest({ version: 1, groups: [] })).toEqual({ kind: 'valid', manifest: { version: 1, groups: [] } });
  const input = fixture(); const question = input.groups[0]!.questions[1]!;
  if (question.type === 'number') throw new Error('Invalid fixture');
  question.type = 'multiple'; question.choices.forEach(choice => { choice.correct = false; });
  expect(inspectQuizManifest(input).kind).toBe('valid');
});
it.each([null, [], {}, 'payload', { version: '1', groups: [] }])('rejects malformed root %j', input => {
  expect(inspectQuizManifest(input)).toEqual({ kind: 'invalid', reason: 'malformed' });
});
it('distinguishes unsupported versions', () => {
  expect(inspectQuizManifest({ version: 2, groups: [] })).toEqual({ kind: 'invalid', reason: 'version' });
});
it.each([
  [['groups'], {}], [['groups', 0, 'questions'], []], [['groups', 0, 'id'], ''],
  [['groups', 0, 'source', 'line'], 0], [['groups', 0, 'source', 'column'], 1.5],
  [['groups', 0, 'conditions', 0, 'expression'], ' '], [['groups', 0, 'seed'], null],
  [['groups', 0, 'questions', 0, 'type'], 'text'], [['groups', 0, 'questions', 0, 'points'], -1],
  [['groups', 0, 'questions', 0, 'points'], '1'], [['groups', 0, 'questions', 0, 'points'], Infinity],
  [['groups', 0, 'questions', 0, 'expected'], ''], [['groups', 0, 'questions', 0, 'tolerance'], NaN],
  [['groups', 0, 'questions', 0, 'relative'], 'true'], [['groups', 0, 'questions', 1, 'choices'], []],
  [['groups', 0, 'questions', 1, 'choices', 0, 'correct'], 'true'],
  [['groups', 0, 'questions', 1, 'choices', 0, 'labelSource'], null],
] as const)('rejects malformed normalized field %j', (path, value) => {
  expect(inspectQuizManifest(change(path, value))).toEqual({ kind: 'invalid', reason: 'malformed' });
});
it('rejects duplicate group/question/choice identities and shared seed bindings', () => {
  const duplicateGroup = fixture(); duplicateGroup.groups.push(structuredClone(duplicateGroup.groups[0]!));
  expect(inspectQuizManifest(duplicateGroup)).toEqual({ kind: 'invalid', reason: 'malformed' });
  const duplicateQuestion = fixture(); duplicateQuestion.groups[0]!.questions[1]!.id = 'question-1';
  expect(inspectQuizManifest(duplicateQuestion)).toEqual({ kind: 'invalid', reason: 'malformed' });
  expect(inspectQuizManifest(change(['groups', 0, 'questions', 1, 'choices', 1, 'id'], 'choice-1'))).toEqual({ kind: 'invalid', reason: 'malformed' });
  const sharedSeed = fixture(); const group = structuredClone(sharedSeed.groups[0]!); group.id = 'quiz-2';
  group.questions.forEach(question => { question.id += '-other'; }); sharedSeed.groups.push(group);
  expect(inspectQuizManifest(sharedSeed)).toEqual({ kind: 'invalid', reason: 'malformed' });
});
it('rejects missing single-choice acceptance and overflowing group totals', () => {
  expect(inspectQuizManifest(change(['groups', 0, 'questions', 1, 'choices', 0, 'correct'], false))).toEqual({ kind: 'invalid', reason: 'malformed' });
  const input = fixture(); input.groups[0]!.questions.forEach(question => { question.points = Number.MAX_VALUE; });
  expect(inspectQuizManifest(input)).toEqual({ kind: 'invalid', reason: 'malformed' });
});
it('checks length/count/depth budgets before walking or hashing oversized input', () => {
  expect(inspectQuizManifest(change(['groups'], new Array(2001)))).toEqual({ kind: 'invalid', reason: 'too-large' });
  expect(inspectQuizManifest(change(['groups', 0, 'questions'], new Array(2001)))).toEqual({ kind: 'invalid', reason: 'too-large' });
  expect(inspectQuizManifest(change(['groups', 0, 'questions', 1, 'choices'], new Array(2001)))).toEqual({ kind: 'invalid', reason: 'too-large' });
  expect(inspectQuizManifest(change(['groups', 0, 'conditions'], new Array(9)))).toEqual({ kind: 'invalid', reason: 'too-large' });
  expect(inspectQuizManifest(change(['groups', 0, 'id'], ' '.repeat(65537)))).toEqual({ kind: 'invalid', reason: 'too-large' });
});
it('enforces cumulative question/choice limits before traversing excess entries', () => {
  const input = fixture(), group = input.groups[0]!;
  group.questions = Array.from({ length: 2000 }, (_, i) => ({ ...structuredClone(group.questions[0]!), id: 'q' + i }));
  const other = structuredClone(group); other.id = 'other'; delete other.seed; other.questions = [{ ...other.questions[0]!, id: 'different' }];
  Object.defineProperty(other.questions, 0, { get() { throw new Error('Excess question traversed'); } });
  input.groups.push(other);
  expect(inspectQuizManifest(input)).toEqual({ kind: 'invalid', reason: 'too-large' });
  const many = fixture(); const choice = many.groups[0]!.questions[1]!;
  if (choice.type === 'number') throw new Error('Invalid fixture');
  choice.choices = Array.from({ length: 1001 }, (_, i) => ({ ...structuredClone(choice.choices[0]!), id: 'c' + i }));
  const second = structuredClone(choice); second.id = 'other';
  Object.defineProperty(second.choices, 0, { get() { throw new Error('Excess choice traversed'); } });
  many.groups[0]!.questions = [choice, second];
  expect(inspectQuizManifest(many)).toEqual({ kind: 'invalid', reason: 'too-large' });
});
it('strips unknown/cyclic extras without traversing or serializing raw objects', () => {
  const input = fixture(); Object.assign(input, { unused: input });
  const checked = inspectQuizManifest(input);
  expect(checked.kind).toBe('valid');
  if (checked.kind !== 'valid') throw new Error('Invalid fixture');
  expect(checked.manifest).not.toHaveProperty('unused');
});
it('contains getter failures and does not evaluate expression or label source', () => {
  expect(inspectQuizManifest({ get version() { throw new Error('Denied'); } })).toEqual({ kind: 'invalid', reason: 'malformed' });
  const input = change(['groups', 0, 'questions', 0, 'expected'], 'notAFunction()');
  expect(inspectQuizManifest(input).kind).toBe('valid'); // Schema validity is not session/source compatibility.
});
it('accepts the compiler exact serialized limit and rejects one extra code unit', () => {
  const text = (label: string) => ':::question{type=multiple}\n::choice[' + label + ']\n:::\n\n::quiz-submit[Check]';
  const initial = renderActive(text('x'), { quizManifest: true }).quiz!;
  const length = 65536 - JSON.stringify(initial).length + 1;
  const exact = renderActive(text('x'.repeat(length)), { quizManifest: true }).quiz!;
  expect(inspectQuizManifest(exact).kind).toBe('valid');
  const question = exact.groups[0]!.questions[0]!;
  if (question.type === 'number') throw new Error('Invalid fixture');
  question.choices[0]!.labelSource += 'x';
  expect(inspectQuizManifest(exact)).toEqual({ kind: 'invalid', reason: 'too-large' });
});

it('rejects sparse arrays at every schema collection boundary', () => {
  for (const path of [['groups'], ['groups', 0, 'conditions'], ['groups', 0, 'questions'], ['groups', 0, 'questions', 1, 'choices']] as const) {
    expect(inspectQuizManifest(change(path, new Array(1)))).toEqual({ kind: 'invalid', reason: 'malformed' });
  }
});
