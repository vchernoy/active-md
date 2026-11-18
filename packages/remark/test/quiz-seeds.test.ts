import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const model = '```calc\ninput firstSeed = 1\ninput secondSeed = 2\ninput topic = 0\nvalue = firstSeed + 1\n```\n\n';
const group = (attributes = '') => `:::question{type=number}\n:answer[firstSeed + 1]\n:::\n\n::quiz-submit[Check]${attributes}`;
const errors = (source: string) => renderActive(model + source).messages.filter(message => message.message.includes('quiz seed') || message.message.includes('own seed'));
it('permits unbound groups and distinct declared input bindings without changing defaults', () => {
  const result = renderActive(model + group() + '\n\n' + group('{seed=firstSeed}') + '\n\n' + group('{seed=secondSeed}'));
  expect(result.messages).toEqual([]);
  expect(result.program?.inputs.map(input => input.default)).toEqual([1, 2, 0]);
  expect(result.html).not.toContain('data-active-quiz');
});
it.each(['{seed=missing}', '{seed=value}', '{seed}', '{seed=""}'])('rejects invalid seed bindings at the submit: %s', attributes => {
  expect(errors(group(attributes))).toContainEqual({ message: 'quiz seed must name a declared calc input', severity: 'error', line: 12, column: 1 });
});
it('rejects reusing a seed across independent groups at the second submit', () => {
  expect(errors(group('{seed=firstSeed}') + '\n\n' + group('{seed=firstSeed}'))).toContainEqual({ message: 'each quiz group must use its own seed input', severity: 'error', line: 18, column: 1 });
});
it.each([':input[firstSeed]', ':input[firstSeed]{widget=slider min=0 max=10}'])('rejects a reader-editable seed control: %s', control => {
  expect(errors(control + '\n\n' + group('{seed=firstSeed}'))).toContainEqual({ message: 'quiz seed inputs cannot have reader-editable controls', severity: 'error', line: 8, column: 1 });
});
it('validates hidden bindings and controls before pruning', () => {
  expect(errors(':::::when[0]\n' + group('{seed=missing}') + '\n:::::')).toContainEqual(expect.objectContaining({ message: 'quiz seed must name a declared calc input', line: 13 }));
  const source = ':::::when[0]\n:input[firstSeed]\n:::::\n\n' + group('{seed=firstSeed}');
  expect(errors(source)).toContainEqual(expect.objectContaining({ message: 'quiz seed inputs cannot have reader-editable controls', line: 9 }));
});
it('keeps a blockquoted submit position and ignores code examples', () => {
  const quoted = group('{seed=missing}').split('\n').map(line => '> ' + line).join('\n');
  expect(errors(quoted)).toContainEqual(expect.objectContaining({ line: 12, column: 3 }));
  expect(errors('`::quiz-submit[Check]{seed=missing}`\n\n```markdown\n' + group('{seed=missing}') + '\n```')).toEqual([]);
});
it('permits ordinary calculator controls unrelated to a bound seed', () => {
  expect(errors(':input[topic]\n\n' + group('{seed=firstSeed}'))).toEqual([]);
});
