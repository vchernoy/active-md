import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const question = (points = '', answer = '') => `:::question{type=number${points}}\nAnswer: :answer[10]${answer}\n:::\n\n::quiz-submit[Check]`;
it.each(['', ' points=0', ' points=0.5', ' points=2', ' points=1e2'])('accepts optional per-question points: %s', points => {
  const result = renderActive(question(points));
  expect(result.messages).toEqual([]);
  expect(result.html).toContain(':::question');
  expect(result.html).not.toContain('data-active-answer');
});
it.each(['-1', 'NaN', 'Infinity', '1e999', '""', '" "'])('rejects malformed question points %s at the question', points => {
  expect(renderActive(question(` points=${points}`)).messages).toContainEqual({ message: 'quiz question points must be a finite nonnegative number', severity: 'error', line: 1, column: 1 });
});
it('rejects a bare points flag rather than interpreting it as zero', () => {
  expect(renderActive(question(' points')).messages).toContainEqual(expect.objectContaining({ message: 'quiz question points must be a finite nonnegative number' }));
});
it('retains the documented numeric answer alias and validates its position', () => {
  expect(renderActive(question('', '{points=2}')).messages).toEqual([]);
  expect(renderActive(question('', '{points=-1}')).messages).toContainEqual({ message: 'quiz question points must be a finite nonnegative number', severity: 'error', line: 2, column: 9 });
});
it.each(['2', '3'])('rejects duplicate point sources even when their values agree: %s', points => {
  expect(renderActive(question(' points=2', `{points=${points}}`)).messages).toContainEqual({ message: 'quiz question points must be declared only once', severity: 'error', line: 2, column: 9 });
});
it.each(['single', 'multiple'])('puts %s weights on the question rather than an individual choice', type => {
  const text = `:::question{type=${type} points=2}\n::choice[Ten]{correct}\n:::\n\n::quiz-submit[Check]`;
  expect(renderActive(text).messages).toEqual([]);
  expect(renderActive(text.replace('{correct}', '{correct points=2}')).messages).toContainEqual({ message: 'quiz points belong on the question, not an individual choice', severity: 'error', line: 2, column: 1 });
});
it('validates hidden points and preserves blockquote coordinates', () => {
  expect(renderActive(':::::when[0]\n' + question(' points=-1') + '\n:::::').messages).toContainEqual({ message: 'quiz question points must be a finite nonnegative number', severity: 'error', line: 2, column: 1 });
  const quoted = question('', '{points=-1}').split('\n').map(line => '> ' + line).join('\n');
  expect(renderActive(quoted).messages).toContainEqual({ message: 'quiz question points must be a finite nonnegative number', severity: 'error', line: 2, column: 11 });
});
it('does not count nested question points as a duplicate declaration on its parent', () => {
  const text = `::::::question{type=number points=2}\n:answer[10]\n\n${question(' points=3').split('\n\n::quiz-submit')[0]}\n::::::\n\n::quiz-submit[Check]`;
  expect(renderActive(text).messages.some(message => message.message.includes('points must be declared only once'))).toBe(false);
});
it('ignores point annotations in code examples', () => {
  expect(renderActive('`:answer[10]{points=-1}`\n\n```markdown\n' + question(' points=-1') + '\n```').messages).toEqual([]);
});
