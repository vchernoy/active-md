// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { mount, type CompletedQuizAttempt, type MountOptions } from '../src/index.js';

const numeric = (expected: string) => `:::question{type=number}\nProduct?\n\n:answer[${expected}]\n:::\n\n`;
const mixed = '```calc\ninput price = 3\n```\n\n' + numeric('4 * price') +
  ':::question{type=single points=2}\nChoose?\n\n::choice[Wrong]\n::choice[Right]{correct}\n:::\n\n' +
  ':::question{type=multiple}\nEven?\n\n::choice[Two]{correct}\n::choice[Three]\n::choice[Four]{correct}\n:::\n\n::quiz-submit[Check]\n\n' +
  numeric('7') + '::quiz-submit[Other]\n';
const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); document.body.innerHTML = ''; });

function setup(source = mixed, options: MountOptions = {}) {
  const rendered = renderActive(source, { quizManifest: true });
  expect(rendered.messages).toEqual([]);
  const root = document.createElement('div'); root.innerHTML = rendered.html; document.body.append(root);
  const attempts: CompletedQuizAttempt[] = [];
  const live = mount(root, { quiz: rendered.quiz, onQuizAttempt: attempt => attempts.push(attempt), ...options });
  cleanups.push(() => live.destroy());
  const button = (group = 'quiz-1') => root.querySelector<HTMLButtonElement>(`[data-active-quiz-group="${group}"] button`)!;
  const answer = (id = 'question-1') => root.querySelector<HTMLInputElement>(`input[data-active-answer="${id}"]`)!;
  const choose = (id: string, choice: string) => { root.querySelector<HTMLInputElement>(`input[data-active-choice="${id}"][value="${choice}"]`)!.checked = true; };
  return { root, live, attempts, button, answer, choose };
}

it('notifies once after a successful Check with accepted responses and frozen weighted scores only', () => {
  const ui = setup();
  ui.answer().value = ' 12 ';
  ui.choose('question-2', 'choice-2');
  ui.choose('question-3', 'choice-1'); ui.choose('question-3', 'choice-3');
  expect(ui.attempts).toEqual([]);
  ui.button().click();
  expect(ui.attempts).toEqual([{
    version: 1, manifestVersion: 1, groupId: 'quiz-1', seed: null, earned: 4, max: 4,
    responses: [
      { questionId: 'question-1', type: 'number', value: 12 },
      { questionId: 'question-2', type: 'single', value: ['choice-2'] },
      { questionId: 'question-3', type: 'multiple', value: ['choice-1', 'choice-3'] },
    ],
    results: [
      { questionId: 'question-1', correct: true, points: 1, earned: 1 },
      { questionId: 'question-2', correct: true, points: 2, earned: 2 },
      { questionId: 'question-3', correct: true, points: 1, earned: 1 },
    ],
  }]);
  expect(ui.button().textContent).toBe('Retry');
  expect(ui.answer().disabled).toBe(true);
  // Unanswered is explicit and the second group does not include the first group's answers.
  ui.button('quiz-2').click();
  expect(ui.attempts[1]).toMatchObject({ groupId: 'quiz-2', earned: 0, max: 1,
    responses: [{ questionId: 'question-4', type: 'number', value: null }] });
});

it('keeps deeply frozen copies unchanged after host mutation, Retry, DOM and live input changes', () => {
  const ui = setup(); ui.answer().value = '12'; ui.button().click();
  const first = ui.attempts[0]!;
  const before = JSON.stringify(first);
  const frozen = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) frozen(child);
  };
  frozen(first);
  expect(() => (first.results as unknown as { earned: number }[])[0]!.earned = 99).toThrow(TypeError);
  expect(() => (first.responses[1]!.value as string[]).push('choice-1')).toThrow(TypeError);
  expect(first.responses[1]!.value).toEqual([]);
  ui.live.session.set('price', 5);
  ui.button().click(); // Retry emits nothing.
  expect(ui.attempts).toHaveLength(1);
  ui.answer().value = '20'; ui.button().click();
  expect(ui.attempts).toHaveLength(2);
  expect(ui.attempts[1]!.results[0]!.correct).toBe(true);
  expect(JSON.stringify(first)).toBe(before);
  expect(JSON.stringify(first)).not.toMatch(/4 \* price|expected|tolerance|labelSource/);
});

it('does not notify for invalid, hidden, failed-evaluation or incompatible checks', () => {
  const ui = setup(); ui.answer().value = 'not a number'; ui.button().click();
  expect(ui.attempts).toEqual([]);
  const failed = setup('```calc\ninput divisor = 0\n```\n\n' + numeric('1 / divisor') + '::quiz-submit[Check]\n');
  failed.button().click(); expect(failed.attempts).toEqual([]);
  const hidden = setup('```calc\ninput visible = 0\n```\n\n::::when[visible]\n' + numeric('1') + '::quiz-submit[Check]\n::::\n');
  hidden.button().click(); expect(hidden.attempts).toEqual([]);
  const bad = setup(mixed, { quiz: null }); bad.button().click(); expect(bad.attempts).toEqual([]);
});

it('captures the actual bound seed and emits nothing for failed Retry or destroy', () => {
  const draws = [4, undefined, 5];
  const ui = setup('```calc\ninput variant = 1 in 0..9\nn = randInt(variant, 1, 100)\n```\n\n' +
    numeric('n') + '::quiz-submit[Check]{seed=variant}\n', { quizSeedSource: () => draws.shift() });
  expect(ui.attempts).toEqual([]); // Initialization emits nothing.
  ui.button().click();
  expect(ui.attempts[0]!.seed).toEqual({ input: 'variant', value: 4 });
  const first = JSON.stringify(ui.attempts[0]);
  ui.button().click(); // Failed draw keeps the completed attempt, no notification.
  expect(ui.button().textContent).toBe('Retry'); expect(ui.attempts).toHaveLength(1);
  ui.button().click(); // Successful Retry also emits nothing.
  expect(ui.button().textContent).toBe('Check'); expect(ui.attempts).toHaveLength(1);
  ui.button().click();
  expect(ui.attempts[1]!.seed).toEqual({ input: 'variant', value: 6 });
  expect(JSON.stringify(ui.attempts[0])).toBe(first);
  ui.live.destroy(); ui.button().click(); expect(ui.attempts).toHaveLength(2);
});

it('calls the host after freezing the UI and contains synchronous callback errors', () => {
  const observed: unknown[] = [];
  const callback = vi.fn(() => {
    observed.push([ui.answer().disabled, ui.button().textContent]);
    throw new Error('host failed');
  });
  const ui = setup(mixed, { onQuizAttempt: callback });
  expect(() => ui.button().click()).not.toThrow();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(observed).toEqual([[true, 'Retry']]);
  ui.button().click(); expect(callback).toHaveBeenCalledTimes(1);
  expect(ui.answer().disabled).toBe(false);
});
