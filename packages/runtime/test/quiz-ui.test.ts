// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renderActive } from '@vchernoy/remark-active';
import { shuffleChoiceIds } from '@vchernoy/calc';
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

/** A scripted seed source: returns the queued offsets in order, then 0. */
const scripted = (...offsets: number[]) => (size: number) => {
  const next = offsets.shift() ?? 0;
  expect(next).toBeLessThan(size);
  return next;
};

const seededSource = '```calc\ninput variant = 1 in 1..1000\nx = randInt(variant, 1, 100)\ny = x * 2\ninput other = 5 in 1..1000\n```\n\n' +
  'Double :value[x]: (:value[y] is the answer)\n\n:::question{type=number}\nQ?\n\n:answer[y]\n:::\n\n::quiz-submit[Check]{seed=variant}\n\n' +
  ':::question{type=number}\nPlain?\n\n:answer[1]\n:::\n\n::quiz-submit[Check plain]\n';

function seeded(source: (size: number) => number | undefined) {
  const rendered = renderActive(seededSource, { quizManifest: true });
  expect(rendered.messages).toEqual([]);
  const root = document.createElement('div');
  root.innerHTML = rendered.html;
  document.body.append(root);
  const live = mount(root, { quiz: rendered.quiz, quizSeedSource: source });
  const [first, second] = [...root.querySelectorAll<HTMLElement>('[data-active-quiz-group]')];
  const answer = (q: string) => root.querySelector<HTMLInputElement>(`input[data-active-answer="${q}"]`)!;
  return { root, live, first: first!, second: second!, answer, value: (name: string) => live.session.inputValues().get(name) };
}

it('draws the seed when the attempt starts, keeps it on Check, and redraws only it on Retry (#48)', () => {
  const ui = seeded(scripted(6, 41));
  // The first attempt drew variant = 1 + 6 inside its declared range 1..1000.
  expect(ui.value('variant')).toBe(7);
  const y = ui.live.session.get('y');
  expect(y?.kind).toBe('value');
  // A dependent binding shows the drawn variant's value, not the default's.
  expect(ui.root.querySelectorAll('output')[1]!.textContent).toBe(String((y as { value: number }).value));
  ui.answer('question-1').value = String((y as { value: number }).value);
  ui.first.querySelector('button')!.click();
  expect(ui.root.querySelector('[data-active-question="question-1"] .active-question-feedback')!.textContent).toBe('Correct (1 of 1)');
  expect(ui.value('variant')).toBe(7);
  // Retry draws among the other 999 values: offset 41 is 42, which skips past the old 7 to 43.
  ui.first.querySelector('button')!.click();
  expect(ui.value('variant')).toBe(43);
  expect(ui.value('other')).toBe(5);
  expect(ui.answer('question-1').value).toBe('');
  const redrawn = ui.live.session.get('y') as { value: number };
  expect(ui.root.querySelectorAll('output')[1]!.textContent).toBe(String(redrawn.value));
});

it('Retry always changes the variant when the range allows, even if the draw repeats', () => {
  // Offset 6 first (variant 7), then offset 6 among the remaining values skips past 7 to 8.
  const ui = seeded(scripted(6, 6));
  expect(ui.value('variant')).toBe(7);
  ui.first.querySelector('button')!.click();
  ui.first.querySelector('button')!.click();
  expect(ui.value('variant')).toBe(8);
});

it('an unbound group never writes a calc input', () => {
  const ui = seeded(scripted(0));
  const before = new Map(ui.live.session.inputValues());
  ui.answer('question-2').value = '1';
  ui.second.querySelector('button')!.click();
  ui.second.querySelector('button')!.click();
  expect(ui.live.session.inputValues()).toEqual(before);
});

it('a seed input whose range holds no integer leaves its group inert', () => {
  const source = '```calc\ninput variant = 0.5 in 0.2..0.8\n```\n\n:::question{type=number}\nQ?\n\n:answer[1]\n:::\n\n::quiz-submit[Check]{seed=variant}\n';
  const rendered = renderActive(source, { quizManifest: true });
  expect(rendered.messages).toEqual([]);
  const root = document.createElement('div');
  root.innerHTML = rendered.html;
  document.body.append(root);
  const live = mount(root, { quiz: rendered.quiz });
  expect(root.querySelector<HTMLButtonElement>('[data-active-quiz-group] button')!.disabled).toBe(true);
  expect(root.querySelector('.active-quiz-status')!.textContent).toBe('This quiz cannot be checked here.');
  expect(live.session.inputValues().get('variant')).toBe(0.5);
});

it('a failing or misbehaving seed source never starts an attempt (#117 review)', () => {
  for (const bad of [() => { throw new Error('no entropy'); }, () => undefined, () => 2.5, () => -1, (size: number) => size]) {
    document.body.innerHTML = '';
    const ui = seeded(bad as (size: number) => number);
    expect(ui.first.querySelector('button')!.disabled).toBe(true);
    expect(ui.first.querySelector('.active-quiz-status')!.textContent).toBe('This quiz cannot be checked here.');
    expect(ui.value('variant')).toBe(1);
    // The unseeded group is unaffected.
    expect(ui.second.querySelector('button')!.disabled).toBe(false);
  }
});

it('a failed Retry draw keeps the checked attempt and says so', () => {
  let calls = 0;
  const ui = seeded(() => (calls++ === 0 ? 6 : undefined));
  ui.answer('question-1').value = '0';
  ui.first.querySelector('button')!.click();
  const checkedStatus = ui.first.querySelector('.active-quiz-status')!.textContent;
  expect(checkedStatus).toBe('Score: 0 of 1');
  ui.first.querySelector('button')!.click();
  expect(ui.first.querySelector('.active-quiz-status')!.textContent).toBe('Could not start a new attempt. Try Retry again.');
  expect([ui.value('variant'), ui.answer('question-1').disabled, ui.first.querySelector('button')!.textContent]).toEqual([7, true, 'Retry']);
});

it('the platform source gives up after a bounded number of rejections instead of looping or biasing', () => {
  // Every word is rejected for a size that does not divide 2^32.
  const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array)[0] = 0xffffffff; return array; });
  try {
    const ui = seeded(undefined as unknown as (size: number) => number);
    expect(ui.first.querySelector('button')!.disabled).toBe(true);
    expect(ui.value('variant')).toBe(1);
    expect(spy.mock.calls.length).toBe(64);
  } finally {
    spy.mockRestore();
  }
});

it('the default seed source is the platform CSPRNG, within range', () => {
  const ui = seeded(undefined as unknown as (size: number) => number);
  const value = ui.value('variant')!;
  expect(Number.isInteger(value) && value >= 1 && value <= 1000).toBe(true);
});

const shuffleSource = '```calc\ninput variant = 1 in 1..1000\n```\n\nIntro\n\n' +
  ':::question{type=single}\nPick the prime:\n\n::choice[4]\n::choice[6]\n::choice[7]{correct}\n::choice[8]\n::choice[9]\n:::\n\n::quiz-submit[Check]{seed=variant}\n\n' +
  ':::question{type=single}\nUnseeded order:\n\n::choice[A]{correct}\n::choice[B]\n::choice[C]\n:::\n\n::quiz-submit[Check plain]\n';
const SHUFFLE_BASE = 0x40000000;

function shuffleFixture(source: (size: number) => number | undefined) {
  const rendered = renderActive(shuffleSource, { quizManifest: true });
  expect(rendered.messages).toEqual([]);
  const root = document.createElement('div');
  root.innerHTML = rendered.html;
  document.body.append(root);
  const live = mount(root, { quiz: rendered.quiz, quizSeedSource: source });
  const order = (q: string) => [...root.querySelectorAll<HTMLInputElement>(`[data-active-question="${q}"] input[data-active-choice]`)].map(el => el.value);
  const button = (n: number) => root.querySelectorAll<HTMLButtonElement>('[data-active-quiz-group] button')[n]!;
  return { root, live, order, button };
}
const ids = ['choice-1', 'choice-2', 'choice-3', 'choice-4', 'choice-5'];
const expected = (seed: number) => { const r = shuffleChoiceIds(ids, seed, SHUFFLE_BASE); if (r.kind !== 'shuffled') throw new Error(r.message); return r.ids; };

it('shows a seeded question\'s choices in the order derived from the attempt seed, and reshuffles on Retry (#48)', () => {
  const ui = shuffleFixture(scripted(6, 41));
  expect(ui.live.session.inputValues().get('variant')).toBe(7);
  expect(ui.order('question-1')).toEqual(expected(7));
  // Grading follows identity, not position: the prime (choice-3) is correct wherever it sits.
  ui.root.querySelector<HTMLInputElement>('input[data-active-choice="question-1"][value="choice-3"]')!.checked = true;
  ui.button(0).click();
  expect(ui.root.querySelector('[data-active-question="question-1"] .active-question-feedback')!.textContent).toBe('Correct (1 of 1)');
  ui.button(0).click();
  expect(ui.live.session.inputValues().get('variant')).toBe(43);
  expect(ui.order('question-1')).toEqual(expected(43));
  // Retry focuses the first choice as shown.
  expect((document.activeElement as HTMLInputElement).value).toBe(expected(43)[0]);
  // Choices stay together, after the question text.
  const question = ui.root.querySelector('[data-active-question="question-1"]')!;
  expect([...question.children].map(el => el.tagName)).toEqual(['P', 'LABEL', 'LABEL', 'LABEL', 'LABEL', 'LABEL']);
});

it('keeps the authored order in unseeded groups, and the same seed gives the same order', () => {
  const first = shuffleFixture(scripted(6));
  expect(first.order('question-2')).toEqual(['choice-1', 'choice-2', 'choice-3']);
  const firstOrder = first.order('question-1');
  document.body.innerHTML = '';
  const again = shuffleFixture(scripted(6));
  expect(again.order('question-1')).toEqual(firstOrder);
});

it('destroy removes the Check handlers', () => {
  const ui = setup();
  ui.live.destroy();
  ui.answer('question-1').value = '12';
  ui.button('quiz-1').click();
  expect(ui.status('quiz-1')).toBe('');
});
