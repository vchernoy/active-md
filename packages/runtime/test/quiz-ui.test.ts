// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '../src/index.js';

// #48: Check / Retry for rendered quiz groups; the manifest comes from the host.
const quiz = (n: number, answer: string) => `:::question{type=number}\nQ${n}?\n\n:answer[${answer}]\n:::\n\n`;
const source = '```calc\ninput a = 3\nb = a * 4\n```\n\n' + quiz(1, 'b') +
  ':::question{type=single points=2}\nBigger?\n\n::choice[1024]{correct}\n::choice[1000]\n:::\n\n' +
  ':::question{type=multiple}\nEven?\n\n::choice[2]{correct}\n::choice[3]\n::choice[4]{correct}\n:::\n\n::quiz-submit[Check]\n\n' +
  'Calculator :edit[A]{input=a}\n\n' + quiz(4, '7') + '::quiz-submit[Check again]\n';

function setup(manifest?: unknown) {
  const rendered = renderActive(source, { quizManifest: true });
  expect(rendered.messages).toEqual([]);
  const root = document.createElement('div');
  root.innerHTML = rendered.html;
  document.body.append(root);
  const live = mount(root, { quiz: manifest === undefined ? rendered.quiz : manifest });
  const group = (id: string) => root.querySelector<HTMLElement>(`[data-active-quiz-group="${id}"]`)!;
  const button = (id: string) => group(id).querySelector('button')!;
  const status = (id: string) => group(id).querySelector('.active-quiz-status')!.textContent;
  const answer = (q: string) => root.querySelector<HTMLInputElement>(`input[data-active-answer="${q}"]`)!;
  const choice = (q: string, c: string) => root.querySelector<HTMLInputElement>(`input[data-active-choice="${q}"][value="${c}"]`)!;
  const feedback = (q: string) => root.querySelector(`[data-active-question="${q}"] .active-question-feedback`)?.textContent ?? null;
  return { root, live, button, status, answer, choice, feedback };
}
afterEach(() => { document.body.innerHTML = ''; });

it('grades a group on Check, freezes it, and Retry reopens only that group', () => {
  const ui = setup();
  expect(ui.button('quiz-1').disabled).toBe(false);
  ui.answer('question-1').value = '12';
  ui.choice('question-2', 'choice-1').checked = true;
  ui.choice('question-3', 'choice-1').checked = true; // Missing choice-3: incorrect.
  ui.answer('question-4').value = '7';
  // Drafts reveal nothing.
  expect(ui.feedback('question-1')).toBeNull();
  ui.button('quiz-1').click();
  expect(ui.status('quiz-1')).toBe('Score: 3 of 4');
  expect(ui.feedback('question-1')).toBe('Correct (1 of 1)');
  expect(ui.feedback('question-2')).toBe('Correct (2 of 2)');
  expect(ui.feedback('question-3')).toBe('Not correct (0 of 1)');
  expect(ui.answer('question-1').disabled).toBe(true);
  expect(ui.choice('question-3', 'choice-2').disabled).toBe(true);
  expect(ui.button('quiz-1').textContent).toBe('Retry');
  // The other group and the calculator are untouched.
  expect(ui.answer('question-4').disabled).toBe(false);
  expect(ui.status('quiz-2')).toBe('');
  ui.button('quiz-1').click();
  expect([ui.answer('question-1').value, ui.answer('question-1').disabled, ui.choice('question-2', 'choice-1').checked]).toEqual(['', false, false]);
  expect([ui.status('quiz-1'), ui.feedback('question-1'), ui.button('quiz-1').textContent]).toEqual(['', null, 'Check']);
  expect(ui.answer('question-4').value).toBe('7');
});

it('checks expected answers against the live calculator values', () => {
  const ui = setup();
  const a = ui.root.querySelector<HTMLInputElement>('input[data-active-input="a"]')!;
  a.value = '5';
  a.dispatchEvent(new Event('input', { bubbles: true }));
  ui.answer('question-1').value = '20';
  ui.button('quiz-1').click();
  expect(ui.feedback('question-1')).toBe('Correct (1 of 1)');
});

it('asks for a number instead of grading text that is not one', () => {
  const ui = setup();
  ui.answer('question-1').value = 'twelve';
  ui.button('quiz-1').click();
  expect(ui.status('quiz-1')).toBe('Enter a number for each numeric answer, or leave it empty.');
  expect(ui.answer('question-1').getAttribute('aria-invalid')).toBe('true');
  expect(ui.answer('question-1').disabled).toBe(false);
  expect(ui.button('quiz-1').textContent).toBe('Check');
});

it('assigns each single-choice question its own radio name', () => {
  const ui = setup();
  const names = [...ui.root.querySelectorAll<HTMLInputElement>('input[type=radio][data-active-choice]')].map(el => el.name);
  expect(new Set(names).size).toBe(1);
  expect(names[0]).toMatch(/^active-quiz-\d+$/);
});

it('leaves quizzes inert with a notice when the manifest is missing or does not fit', () => {
  const withoutManifest = setup(null);
  expect(withoutManifest.button('quiz-1').disabled).toBe(true);
  expect(withoutManifest.status('quiz-1')).toBe('This quiz cannot be checked here.');
  document.body.innerHTML = '';
  const rendered = renderActive(source, { quizManifest: true });
  const root = document.createElement('div');
  root.innerHTML = rendered.html;
  document.body.append(root);
  mount(root);
  expect(root.querySelector<HTMLButtonElement>('[data-active-quiz-group] button')!.disabled).toBe(true);
});

it('leaves a group inert when a stale manifest describes other controls (#114 review)', () => {
  // The manifest says question-1 is numeric; the rendered HTML makes it single-choice.
  const numeric = renderActive(':::question{type=number}\nQ?\n\n:answer[1]\n:::\n\n::quiz-submit[Check]\n', { quizManifest: true });
  const single = renderActive(':::question{type=single}\nQ?\n\n::choice[One]{correct}\n::choice[Two]\n:::\n\n::quiz-submit[Check]\n', { quizManifest: true });
  const root = document.createElement('div');
  root.innerHTML = single.html;
  document.body.append(root);
  mount(root, { quiz: numeric.quiz });
  const button = root.querySelector<HTMLButtonElement>('[data-active-quiz-group] button')!;
  expect(button.disabled).toBe(true);
  expect(root.querySelector('.active-quiz-status')!.textContent).toBe('This quiz cannot be checked here.');
  // Same type, different choices: also inert.
  const fewer = renderActive(':::question{type=single}\nQ?\n\n::choice[One]{correct}\n:::\n\n::quiz-submit[Check]\n', { quizManifest: true });
  root.innerHTML = single.html;
  mount(root, { quiz: fewer.quiz });
  expect(root.querySelector<HTMLButtonElement>('[data-active-quiz-group] button')!.disabled).toBe(true);
  // A matching manifest enables it.
  root.innerHTML = single.html;
  mount(root, { quiz: single.quiz });
  expect(root.querySelector<HTMLButtonElement>('[data-active-quiz-group] button')!.disabled).toBe(false);
});

it('destroy removes the Check handlers', () => {
  const ui = setup();
  ui.live.destroy();
  ui.answer('question-1').value = '12';
  ui.button('quiz-1').click();
  expect(ui.status('quiz-1')).toBe('');
});
