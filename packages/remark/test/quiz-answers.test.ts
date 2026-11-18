import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const question = (expression: string) => `:::question{type=number}\nAnswer: :answer[${expression}]\n:::\n\n::quiz-submit[Check]`;
const errors = (text: string) => renderActive(text).messages.filter(message => message.message.startsWith('quiz answer:'));
it.each(['10', '2*3*4', 'if(1, 10, 20)', 'sqrt(16)'])('accepts supported literal/expression syntax without transforming quiz controls: %s', expression => {
  const result = renderActive(question(expression));
  expect(result.messages).toEqual([]);
  expect(result.html).toContain(':answer[');
  expect(result.html).not.toContain('data-active-answer');
});
it('resolves calc names including model inputs and seeded dependent values', () => {
  expect(errors('```calc\ninput seed = 1\nx = randInt(seed, 1, 10)\n```\n\n' + question('x + seed'))).toEqual([]);
});
it.each(['missing', '1 +', '', 'unknownFunction(1)'])('reports invalid expressions at the answer rather than question position: %s', expression => {
  const messages = errors('Intro\n\n' + question(expression));
  expect(messages.length).toBeGreaterThan(0);
  expect(messages).toEqual(expect.arrayContaining([expect.objectContaining({ severity: 'error', line: 4, column: 9 })]));
});
it('checks hidden answers before pruning and preserves blockquote source positions', () => {
  const hidden = ':::::when[0]\n' + question('missing') + '\n:::::';
  expect(errors(hidden)).toContainEqual(expect.objectContaining({ line: 3, column: 9, severity: 'error' }));
  const quoted = question('missing').split('\n').map(line => '> ' + line).join('\n');
  expect(errors(quoted)).toContainEqual(expect.objectContaining({ line: 2, column: 11, severity: 'error' }));
});
it('does not compile inline or fenced quiz examples', () => {
  expect(errors('`:answer[missing]`\n\n```markdown\n' + question('missing') + '\n```')).toEqual([]);
});
it('does not grade a syntactically valid input-dependent answer at author defaults', () => {
  expect(errors('```calc\ninput x = 0\n```\n\n' + question('1 / x'))).toEqual([]);
});
