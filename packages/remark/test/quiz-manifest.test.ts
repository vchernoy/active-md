import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const number = (attributes = '', answer = ':answer[2*3*4]') => `:::question{type=number${attributes}}\n${answer}\n:::`;
const submit = '::quiz-submit[Check]';
const manifest = (source: string) => renderActive(source, { quizManifest: true });
it('requires explicit opt-in and leaves sanitized HTML and program unchanged', () => {
  const source = number() + '\n\n' + submit;
  const plain = renderActive(source), prepared = manifest(source);
  expect(plain).not.toHaveProperty('quiz');
  expect(prepared.html).toBe(plain.html);
  expect(prepared.messages).toEqual([]);
  expect(prepared.quiz).toMatchObject({ version: 1, groups: [{ id: 'quiz-1', conditions: [], questions: [{ id: 'question-1', type: 'number', points: 1, expected: '2*3*4', tolerance: 0, relative: false }] }] });
  expect(prepared.html).not.toContain('data-active-quiz');
});
it('normalizes numeric options and the earlier points alias without evaluating answers', () => {
  const source = '```calc\ninput x = 0\n```\n\n' + number('', ':answer[1/x]{points=2 tolerance=0.01 relative}') + '\n\n' + submit;
  expect(manifest(source).quiz?.groups[0]?.questions[0]).toMatchObject({ expected: '1/x', points: 2, tolerance: 0.01, relative: true });
});
it('normalizes choices with stable per-question identities and raw Markdown labels', () => {
  const source = ':::question{type=single points=0.5}\n::choice[**Ten**]{correct}\n\n::choice[10]{correct=true}\n\n::choice[Eleven]{correct=false}\n:::\n\n' + submit;
  expect(manifest(source).quiz?.groups[0]?.questions[0]).toMatchObject({ type: 'single', points: 0.5, choices: [
    { id: 'choice-1', labelSource: '**Ten**', correct: true }, { id: 'choice-2', labelSource: '10', correct: true }, { id: 'choice-3', labelSource: 'Eleven', correct: false },
  ] });
});
it('retains source-order groups before hidden pruning with outer-to-inner conditions and seed bindings', () => {
  const group = '::::::when[topic > 0]\n:::::when[0]\n' + number() + '\n\n::quiz-submit[Check]{seed=seed}\n:::::\n::::::';
  const source = '```calc\ninput seed = 1\ninput topic = 0\n```\n\n' + number() + '\n\n' + submit + '\n\n' + group;
  const result = manifest(source);
  expect(result.messages).toEqual([]);
  expect(result.quiz?.groups.map(group => [group.id, group.conditions.map(condition => condition.expression), group.seed, group.questions[0]?.id])).toEqual([
    ['quiz-1', [], undefined, 'question-1'], ['quiz-2', ['topic > 0', '0'], 'seed', 'question-2'],
  ]);
});
it('preserves original blockquote positions in question, choice and submit metadata', () => {
  const source = '> :::question{type=multiple}\n> ::choice[Ten]\n> :::\n>\n> ' + submit;
  const group = manifest(source).quiz?.groups[0];
  expect(group?.source).toEqual({ line: 5, column: 3 });
  expect(group?.questions[0]?.source).toEqual({ line: 1, column: 3 });
  expect(group?.questions[0]).toMatchObject({ choices: [{ source: { line: 2, column: 3 }, correct: false }] });
});
it.each([number(' points=-1'), number('', ':answer[missing]'), ':::question{type=single}\n::choice[Ten]\n:::'])('omits all metadata for invalid authoring: %s', question => {
  const result = manifest(number() + '\n\n' + submit + '\n\n' + question + '\n\n' + submit);
  expect(result.messages.some(message => message.severity === 'error')).toBe(true);
  expect(result).not.toHaveProperty('quiz');
});
it('does not publish malformed hidden conditions or overflowing group totals', () => {
  const hidden = '::::::when[0]\n:::::when[missing]\n' + number() + '\n\n' + submit + '\n:::::\n::::::';
  expect(manifest(hidden)).not.toHaveProperty('quiz');
  expect(manifest(hidden).messages).toContainEqual(expect.objectContaining({ message: 'quiz condition: unknown name \"missing\"', line: 2, column: 1 }));
  const result = manifest(number(' points=1e308') + '\n\n' + number(' points=1e308') + '\n\n' + submit);
  expect(result.messages).toContainEqual(expect.objectContaining({ message: 'quiz group point totals must remain finite' }));
  expect(result).not.toHaveProperty('quiz');
});
it('has no entries for inline/fenced examples and produces independent repeatable objects', () => {
  expect(manifest('`:answer[missing]`\n\n```markdown\n' + number() + '\n```').quiz).toEqual({ version: 1, groups: [] });
  const source = number() + '\n\n' + submit;
  const first = manifest(source).quiz!, second = manifest(source).quiz!;
  expect(first).toEqual(second); first.groups[0]!.questions[0]!.points = 99;
  expect(second.groups[0]!.questions[0]!.points).toBe(1);
});
it('bounds captured text without affecting default rendering or exposing partial groups', () => {
  const source = ':::question{type=multiple}\n::choice[' + 'x'.repeat(65537) + ']\n:::\n\n' + submit;
  expect(renderActive(source).messages).toEqual([]);
  const result = manifest(source);
  expect(result.messages).toContainEqual(expect.objectContaining({ message: 'quiz manifest exceeds the text budget' }));
  expect(result).not.toHaveProperty('quiz');
});
it('bounds serialized metadata overhead and total question/choice counts', () => {
  const choices = Array.from({ length: 800 }, (_, i) => `::choice[Option ${i}]`).join('\n\n');
  expect(manifest(':::question{type=multiple}\n' + choices + '\n:::\n\n' + submit).messages).toContainEqual(expect.objectContaining({ message: 'quiz manifest exceeds the serialized budget' }));
  const questions = Array.from({ length: 2001 }, () => number()).join('\n\n');
  expect(manifest(questions + '\n\n' + submit).messages).toContainEqual(expect.objectContaining({ message: 'quiz manifest exceeds the question limit' }));
  const manyChoices = Array.from({ length: 2001 }, () => '::choice[x]').join('\n\n');
  expect(manifest(':::question{type=multiple}\n' + manyChoices + '\n:::\n\n' + submit).messages).toContainEqual(expect.objectContaining({ message: 'quiz manifest exceeds the choice limit' }));
});
it('accepts the exact serialized budget and rejects one extra code unit atomically', () => {
  const source = (label: string) => ':::question{type=multiple}\n::choice[' + label + ']\n:::\n\n' + submit;
  const baseline = manifest(source('x')).quiz!;
  const length = 65536 - JSON.stringify(baseline).length + 1;
  const exact = manifest(source('x'.repeat(length)));
  expect(exact.messages).toEqual([]);
  expect(JSON.stringify(exact.quiz).length).toBe(65536);
  const over = manifest(source('x'.repeat(length + 1)));
  expect(over).not.toHaveProperty('quiz');
  expect(over.messages).toContainEqual(expect.objectContaining({ message: 'quiz manifest exceeds the serialized budget' }));
});
it('does not treat ordinary paragraphs as labels in hidden when containers', () => {
  const source = '::::::when[0]\n:::::when\n1\n\n' + number() + '\n\n' + submit + '\n:::::\n::::::';
  const result = manifest(source);
  expect(result).not.toHaveProperty('quiz');
  expect(result.messages).toContainEqual(expect.objectContaining({ message: expect.stringContaining('quiz condition:'), line: 2, column: 1 }));
  const labelled = manifest(source.replace(':::::when\n1', ':::::when[1]\n1'));
  expect(labelled.messages).toEqual([]);
  expect(labelled.quiz?.groups[0]?.conditions.map(condition => condition.expression)).toEqual(['0', '1']);
});
