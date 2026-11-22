import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderActive } from '../src/index.js';

// #48: quiz directives render as controls only for opted-in, error-free manifests.
const source = '```calc\ninput x = 2\n```\n\n:::question{type=number}\nWhat is 10% of 100?\n\n:answer[10]{tolerance=0.5}\n:::\n\nText with :value[x].\n\n' +
  ':::question{type=single points=2}\nBigger?\n\n::choice[$2^{10}$]{correct}\n::choice[*ten* cubed]\n:::\n\n' +
  ':::question{type=multiple}\nEven?\n\n::choice[2]{correct}\n::choice[3]\n:::\n\n::quiz-submit[Check answers]\n';

it('renders questions, answers, choices and a disabled Check keyed by manifest ids', () => {
  const result = renderActive(source, { quizManifest: true });
  expect(result.messages).toEqual([]);
  const doc = new JSDOM(result.html).window.document;
  expect([...doc.querySelectorAll('fieldset.active-question')].map(el => [el.getAttribute('data-active-question'), el.getAttribute('aria-label')]))
    .toEqual([['question-1', 'Question 1'], ['question-2', 'Question 2'], ['question-3', 'Question 3']]);
  const answer = doc.querySelector('input.active-answer')!;
  expect([answer.getAttribute('type'), answer.getAttribute('inputmode'), answer.getAttribute('data-active-answer'), answer.getAttribute('aria-label')])
    .toEqual(['text', 'decimal', 'question-1', 'Your answer']);
  expect([...doc.querySelectorAll('label.active-choice input')].map(el => [el.getAttribute('type'), el.getAttribute('value'), el.getAttribute('data-active-choice')]))
    .toEqual([['radio', 'choice-1', 'question-2'], ['radio', 'choice-2', 'question-2'], ['checkbox', 'choice-1', 'question-3'], ['checkbox', 'choice-2', 'question-3']]);
  // Rich choice labels survive: math and emphasis.
  expect(doc.querySelectorAll('label.active-choice math')).toHaveLength(1);
  expect(doc.querySelector('label.active-choice em')?.textContent).toBe('ten');
  const submit = doc.querySelector('[data-active-quiz-group="quiz-1"]')!;
  const button = submit.querySelector('button')!;
  expect([button.textContent, button.hasAttribute('disabled'), button.getAttribute('type')]).toEqual(['Check answers', true, 'button']);
  expect(submit.querySelector('[role=status]')).not.toBeNull();
  // The manifest ids match the HTML.
  expect(result.quiz?.groups.map(group => [group.id, group.questions.map(question => question.id)]))
    .toEqual([['quiz-1', ['question-1', 'question-2', 'question-3']]]);
});

it('never puts expected answers, tolerances or correct flags into the HTML', () => {
  const html = renderActive(source, { quizManifest: true }).html;
  expect(html).not.toMatch(/correct|tolerance|expected|data-active-answer="[^"]*10/);
  expect(html).not.toContain(':answer');
  expect(html).not.toContain('{correct}');
});

it('keeps literal source without the opt-in or when the document has errors', () => {
  expect(renderActive(source).html).toContain(':::question{type=number}');
  expect(renderActive(source).html).not.toContain('active-question');
  const broken = renderActive(source.replace('::quiz-submit[Check answers]\n', ''), { quizManifest: true });
  expect(broken.messages.length).toBeGreaterThan(0);
  expect(broken.quiz).toBeUndefined();
  expect(broken.html).not.toContain('active-question');
  expect(broken.html).toContain(':::question{type=number}');
});

it('renders a group inside a when block, and two groups with their own ids', () => {
  const two = '```calc\ninput topic = 1 in 1..2\n```\n\n::::when[topic == 1]\n:::question{type=number}\nOne?\n\n:answer[1]\n:::\n\n::quiz-submit[Check]\n::::\n\n:::question{type=number}\nTwo?\n\n:answer[2]\n:::\n\n::quiz-submit[Check]\n';
  const result = renderActive(two, { quizManifest: true });
  expect(result.messages).toEqual([]);
  const doc = new JSDOM(result.html).window.document;
  expect([...doc.querySelectorAll('[data-active-quiz-group]')].map(el => el.getAttribute('data-active-quiz-group'))).toEqual(['quiz-1', 'quiz-2']);
  expect(doc.querySelector('[data-active-when] [data-active-quiz-group="quiz-1"]')).not.toBeNull();
});
