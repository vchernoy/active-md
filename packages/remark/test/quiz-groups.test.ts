import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
const question = (answer = ':answer[10]') => `:::question{type=number}\nWhat is ten?\n\n${answer}\n:::`;
const submit = '::quiz-submit[Check]';
const model = '```calc\ninput topic = 0\n```\n\n';
const when = (condition: string, text: string) => `:::::when[${condition}]\n${text}\n:::::`;
const messages = (text: string) => renderActive(model + text).messages;
it('groups interleaved questions by submits without needing IDs and keeps valid directives literal for now', () => {
  const text = `${question()}\n\nOrdinary content.\n\n${question()}\n\n${submit}\n\n${question()}\n\n${submit}`;
  const rendered = renderActive(text);
  expect(rendered.messages).toEqual([]);
  expect(rendered.html).toContain(':::question');
  expect(rendered.html).not.toContain('data-active-answer');
});
it('accepts independent complete conditional groups before visibility is evaluated', () => {
  expect(messages(when('topic == 0', `${question()}\n\n${submit}`) + '\n\n' + when('topic != 0', `${question()}\n\n${submit}`))).toEqual([]);
  expect(messages(when('0', `${question()}\n\n${submit}`))).toEqual([]);
});
it('permits conditional explanatory text inside a question without gating its answer', () => {
  expect(messages(`::::::question{type=number}\nExplanation\n\n:::when[topic]\nHint\n:::\n\n:answer[10]\n::::::\n\n${submit}`)).toEqual([]);
});
it.each([`${submit}`, `${question()}\n\n${submit}\n\n${submit}`])('reports an empty group at its submit: %s', text => {
  expect(renderActive(text).messages).toContainEqual(expect.objectContaining({ message: 'quiz-submit has an empty question group', severity: 'error', column: 1 }));
});
it('reports every unsubmitted question with original source positions', () => {
  expect(renderActive('Intro\n\n' + question()).messages).toEqual([
    { message: 'quiz question has no following quiz-submit', severity: 'error', line: 3, column: 1 },
  ]);
});
it.each([
  when('topic', question()) + '\n\n' + submit,
  question() + '\n\n' + when('topic', submit),
  when('topic', question()) + '\n\n' + when('topic', submit),
  when('0', question()) + '\n\n' + submit,
])('rejects partial or separate conditional groups before pruning', text => {
  expect(messages(text)).toContainEqual(expect.objectContaining({ message: expect.stringContaining('question and its submit'), severity: 'error', column: 1 }));
});
it.each([':answer[10]', '::choice[Ten]{correct}'])('rejects a required control hidden independently: %s', control => {
  const text = `::::::question{type=number}\nQuestion\n\n:::when[topic]\n${control}\n:::\n::::::\n\n${submit}`;
  expect(messages(text)).toContainEqual(expect.objectContaining({ message: expect.stringContaining("question's enclosing when"), severity: 'error' }));
});
it.each([':answer[10]', '::choice[Ten]'])('rejects orphan controls with positions: %s', text => {
  expect(renderActive('Intro\n\n' + text).messages).toContainEqual(expect.objectContaining({ message: expect.stringContaining('inside a question'), line: 3, column: 1 }));
});
it('rejects nested questions, submits inside questions and wrong directive kinds', () => {
  const text = `::::::question{type=number}\n${question()}\n\n${submit}\n::::::\n\n${submit}`;
  expect(messages(text).map(message => message.message)).toEqual(expect.arrayContaining(['quiz questions cannot be nested', 'quiz-submit must be outside question containers']));
  for (const invalid of [':question[Text]', ':quiz-submit[Check]', question('::answer[10]'), question(':choice[Ten]')]) {
    expect(messages(invalid).some(message => message.message.includes('must use'))).toBe(true);
  }
});
it('does not interpret code examples as quiz directives', () => {
  expect(messages('`:answer[10]`\n\n```markdown\n' + question() + '\n' + submit + '\n```')).toEqual([]);
});
it.each(['single', 'multiple'])('accepts grouped %s choice controls without implementing their grading', type => {
  const text = question('::choice[Ten]{correct}\n\n::choice[Eleven]').replace('type=number', `type=${type}`) + '\n\n' + submit;
  expect(messages(text)).toEqual([]);
});
it('reports each unsubmitted question rather than merging trailing leftovers silently', () => {
  expect(renderActive(question() + '\n\n' + question()).messages.map(message => message.line)).toEqual([1, 7]);
});
it('preserves positions through a Markdown blockquote', () => {
  const text = 'Intro\n\n> :::question{type=number}\n> Question\n>\n> :answer[10]\n> :::';
  expect(renderActive(text).messages).toContainEqual({ message: 'quiz question has no following quiz-submit', severity: 'error', line: 3, column: 3 });
});
