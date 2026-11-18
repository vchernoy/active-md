import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const question = (attributes = '') => `:::question{type=number}\nAnswer: :answer[10]${attributes}\n:::\n\n::quiz-submit[Check]`;
const toleranceError = 'quiz answer tolerance must be a finite nonnegative number';
const relativeError = 'quiz answer relative must be a boolean flag (true or false)';
it.each(['', '{tolerance=0}', '{tolerance=0.01}', '{tolerance=1e-3 relative}', '{tolerance=2 relative=false}', '{relative=true}'])('accepts supported answer options without grading: %s', attributes => {
  const result = renderActive(question(attributes));
  expect(result.messages).toEqual([]);
  expect(result.html).toContain(':answer[10]');
  expect(result.html).not.toContain('data-active-answer');
});
it.each(['{tolerance=-1}', '{tolerance=NaN}', '{tolerance=Infinity}', '{tolerance=-Infinity}', '{tolerance=1e999}', '{tolerance=""}', '{tolerance}'])('rejects invalid tolerance at the answer: %s', attributes => {
  expect(renderActive(question(attributes)).messages).toContainEqual({ message: toleranceError, severity: 'error', line: 2, column: 9 });
});
it.each(['yes', '1', 'False', 'TRUE'])('rejects ambiguous relative flag %s', relative => {
  expect(renderActive(question(`{relative=${relative}}`)).messages).toContainEqual({ message: relativeError, severity: 'error', line: 2, column: 9 });
});
it('validates hidden options before pruning and preserves blockquote positions', () => {
  const hidden = ':::::when[0]\n' + question('{tolerance=-1 relative=yes}') + '\n:::::';
  expect(renderActive(hidden).messages).toEqual(expect.arrayContaining([
    { message: toleranceError, severity: 'error', line: 3, column: 9 },
    { message: relativeError, severity: 'error', line: 3, column: 9 },
  ]));
  const quoted = question('{tolerance=-1}').split('\n').map(line => '> ' + line).join('\n');
  expect(renderActive(quoted).messages).toContainEqual({ message: toleranceError, severity: 'error', line: 2, column: 11 });
});
it('does not validate attributes in inline or fenced examples', () => {
  expect(renderActive('`:answer[10]{tolerance=-1}`\n\n```markdown\n' + question('{relative=yes}') + '\n```').messages).toEqual([]);
});
