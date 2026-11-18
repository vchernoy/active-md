import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const question = (choices: string, type = 'single') => `:::question{type=${type}}\nChoose.\n\n${choices}\n:::\n\n::quiz-submit[Check]`;
it('requires at least one accepted choice for single selection', () => {
  expect(renderActive(question('::choice[Ten]\n\n::choice[Eleven]{correct=false}', 'single')).messages).toContainEqual({ message: 'choice quiz question must mark at least one choice correct', severity: 'error', line: 1, column: 1 });
});
it.each(['single', 'multiple'])('permits several accepted choices for %s and keeps directives literal', type => {
  const result = renderActive(question('::choice[Ten]{correct}\n\n::choice[10]{correct=true}\n\n::choice[Eleven]{correct=false}', type));
  expect(result.messages).toEqual([]);
  expect(result.html).toContain('::choice');
  expect(result.html).not.toContain('data-active-choice');
});
it.each(['yes', '1', 'False', 'TRUE'])('rejects ambiguous correct flag %s at its choice', flag => {
  expect(renderActive(question(`::choice[Ten]{correct=${flag}}\n\n::choice[Eleven]{correct}`)).messages).toContainEqual({ message: 'quiz choice correct must be a boolean flag (true or false)', severity: 'error', line: 4, column: 1 });
});
it('validates accepted choices before hidden pruning and keeps blockquote coordinates', () => {
  expect(renderActive(':::::when[0]\n' + question('::choice[Ten]') + '\n:::::').messages).toContainEqual({ message: 'choice quiz question must mark at least one choice correct', severity: 'error', line: 2, column: 1 });
  const quoted = question('::choice[Ten]{correct=yes}').split('\n').map(line => '> ' + line).join('\n');
  expect(renderActive(quoted).messages).toContainEqual({ message: 'quiz choice correct must be a boolean flag (true or false)', severity: 'error', line: 4, column: 3 });
});
it('does not borrow accepted choices from an invalid nested question', () => {
  const inner = ':::question{type=single}\n::choice[Ten]{correct}\n:::';
  const text = `::::::question{type=single}\n::choice[Eleven]\n\n${inner}\n::::::\n\n::quiz-submit[Check]`;
  expect(renderActive(text).messages).toContainEqual({ message: 'choice quiz question must mark at least one choice correct', severity: 'error', line: 1, column: 1 });
});
it('ignores correct flags in code examples rather than creating accepted choices', () => {
  expect(renderActive(question('`::choice[Ten]{correct}`\n\n::choice[Eleven]')).messages).toContainEqual(expect.objectContaining({ message: 'choice quiz question must mark at least one choice correct' }));
});

it('permits an empty correct set for multiple selection', () => {
  expect(renderActive(question('::choice[Ten]\n\n::choice[Eleven]{correct=false}', 'multiple')).messages).toEqual([]);
});
