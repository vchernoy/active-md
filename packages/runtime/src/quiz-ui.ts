import type { Session } from '@vchernoy/calc';
import { checkQuizGroup, type QuizGroupCheck } from './quiz-check.js';
import { compileQuizManifest } from './quiz-compile.js';

let nextQuizRadioName = 0;

const points = (value: number): string => String(Number(value.toFixed(6)));

/** A uniform integer in `[0, size)` for `size <= 2^32`, from the platform's CSPRNG. */
export type QuizSeedSource = (size: number) => number;
const SEED_MAX = 4294967295;
const cryptoSource: QuizSeedSource = size => {
  // Rejection sampling keeps the draw uniform for sizes that do not divide 2^32.
  const limit = Math.floor(2 ** 32 / size) * size;
  const word = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(word);
    if (word[0]! < limit) return word[0]! % size;
  }
};

/** The integers a seed input may take: its declared range (clamped to calc's seed domain) or all seeds. */
function seedBounds(session: Session, name: string): { min: number; size: number } | undefined {
  const input = session.program.inputs.find(candidate => candidate.name === name);
  if (!input) return undefined;
  const min = Math.max(0, Math.ceil(input.range?.min ?? 0));
  const max = Math.min(SEED_MAX, Math.floor(input.range?.max ?? SEED_MAX));
  return max >= min ? { min, size: max - min + 1 } : undefined;
}

/**
 * Check / Retry for quiz groups rendered with `renderActive(…, { quizManifest: true })` (#48).
 * The manifest comes from the host, never from the HTML. Draft answers reveal nothing; Check
 * grades and freezes one group; Retry clears and reopens only that group. A group bound to
 * `seed=` draws its input when the attempt starts (mount) and again on Retry, never on Check.
 * Returns a cleanup. Host attempt snapshots are a later slice.
 */
export function mountQuizzes(doc: HTMLElement, manifest: unknown, session: Session, source: QuizSeedSource = cryptoSource): () => void {
  const submits = [...doc.querySelectorAll<HTMLElement>('[data-active-quiz-group]')];
  if (!submits.length) return () => undefined;
  const compiled = compileQuizManifest(manifest, session);
  if (compiled.kind !== 'compiled') {
    for (const submit of submits) {
      const status = submit.querySelector<HTMLElement>('.active-quiz-status');
      if (status) status.textContent = 'This quiz cannot be checked here.';
    }
    return () => undefined;
  }
  // Compare dataset values rather than building selectors from host-supplied ids.
  const questions = [...doc.querySelectorAll<HTMLElement>('[data-active-question]')];
  const answers = [...doc.querySelectorAll<HTMLInputElement>('input[data-active-answer]')];
  const choices = [...doc.querySelectorAll<HTMLInputElement>('input[data-active-choice]')];
  const questionEl = (id: string) => questions.find(el => el.dataset.activeQuestion === id);
  const answerEl = (id: string) => answers.find(el => el.dataset.activeAnswer === id);
  const choiceEls = (id: string) => choices.filter(el => el.dataset.activeChoice === id);
  // Radio names are assigned per mount (sanitizing would prefix authored names).
  for (const group of compiled.manifest.groups) for (const question of group.questions) {
    if (question.type !== 'single') continue;
    let name: string;
    do { name = `active-quiz-${++nextQuizRadioName}`; } while (doc.ownerDocument.getElementsByName(name).length);
    for (const input of choiceEls(question.id)) input.name = name;
  }
  const cleanups: (() => void)[] = [];
  for (const submit of submits) {
    const group = compiled.manifest.groups.find(candidate => candidate.id === submit.dataset.activeQuizGroup);
    const button = submit.querySelector<HTMLButtonElement>('button.active-quiz-check');
    const status = submit.querySelector<HTMLElement>('.active-quiz-status');
    if (!group || !button || !status) continue;
    // Seeded (randomized) groups need the seed lifecycle, which is not implemented yet: keep
    // them inert rather than present a Retry that never draws a new variant.
    // A seeded group owns its bound input: draw it now (the first attempt) and on each Retry.
    const seed = group.seed;
    const bounds = seed === undefined ? undefined : seedBounds(session, seed);
    if (seed !== undefined && !bounds) {
      status.textContent = 'This quiz cannot be checked here.';
      continue;
    }
    // A stale manifest can share ids with different controls: enable Check only when every
    // question's rendered controls are exactly the kind and choices the manifest describes.
    const fits = group.questions.every(question => {
      if (!questionEl(question.id)) return false;
      const answerCount = answers.filter(el => el.dataset.activeAnswer === question.id).length;
      const rendered = choiceEls(question.id);
      if (question.type === 'number') return answerCount === 1 && rendered.length === 0;
      const kind = question.type === 'single' ? 'radio' : 'checkbox';
      const ids = rendered.map(el => el.value);
      return answerCount === 0 && rendered.every(el => el.type === kind) && ids.length === question.choices.length
        && new Set(ids).size === ids.length && question.choices.every(choice => ids.includes(choice.id));
    });
    if (!fits) {
      status.textContent = 'This quiz cannot be checked here.';
      continue;
    }
    /** Set a new variant; on Retry it differs from the last one whenever the range allows. */
    const drawVariant = (differFrom?: number): boolean => {
      if (seed === undefined || !bounds) return true;
      let value: number;
      if (differFrom !== undefined && bounds.size > 1 && differFrom >= bounds.min && differFrom < bounds.min + bounds.size) {
        value = bounds.min + source(bounds.size - 1);
        if (value >= differFrom) value += 1;
      } else value = bounds.min + source(bounds.size);
      return session.set(seed, value) === undefined;
    };
    if (!drawVariant()) {
      status.textContent = 'This quiz cannot be checked here.';
      continue;
    }
    const checkLabel = button.dataset.activeQuizLabel || button.textContent || 'Check';
    const controls = () => group.questions.flatMap(question => question.type === 'number' ? [answerEl(question.id)].filter((el): el is HTMLInputElement => !!el) : choiceEls(question.id));
    let checked = false;

    const clearFeedback = (): void => {
      for (const question of group.questions) {
        const el = questionEl(question.id);
        el?.classList.remove('active-question-correct', 'active-question-incorrect');
        el?.querySelector('.active-question-feedback')?.remove();
        answerEl(question.id)?.removeAttribute('aria-invalid');
      }
    };
    const show = (result: Extract<QuizGroupCheck, { kind: 'checked' }>): void => {
      for (const row of result.results) {
        const el = questionEl(row.questionId);
        if (!el) continue;
        el.classList.add(row.correct ? 'active-question-correct' : 'active-question-incorrect');
        const feedback = el.ownerDocument.createElement('p');
        feedback.className = 'active-question-feedback';
        feedback.textContent = row.correct ? `Correct (${points(row.earned)} of ${points(row.points)})` : `Not correct (0 of ${points(row.points)})`;
        el.append(feedback);
        if (!row.correct) answerEl(row.questionId)?.setAttribute('aria-invalid', 'true');
      }
      status.textContent = `Score: ${points(result.earned)} of ${points(result.max)}`;
    };
    const check = (): void => {
      const responses = new Map<string, number | readonly string[]>();
      for (const question of group.questions) {
        if (question.type === 'number') {
          const input = answerEl(question.id);
          const raw = input?.value.trim() ?? '';
          if (!raw) continue;
          const value = Number(raw);
          if (!Number.isFinite(value)) {
            status.textContent = 'Enter a number for each numeric answer, or leave it empty.';
            input?.setAttribute('aria-invalid', 'true');
            input?.focus();
            return;
          }
          responses.set(question.id, value);
        } else {
          const chosen = choiceEls(question.id).filter(input => input.checked).map(input => input.value);
          if (chosen.length) responses.set(question.id, chosen);
        }
      }
      const result = checkQuizGroup(compiled, group.id, responses);
      if (result.kind === 'hidden') { status.textContent = 'This quiz is not shown.'; return; }
      if (result.kind === 'invalid') { status.textContent = 'This quiz could not be checked.'; return; }
      clearFeedback();
      show(result);
      for (const control of controls()) control.disabled = true;
      checked = true;
      button.textContent = 'Retry';
    };
    const retry = (): void => {
      drawVariant(seed === undefined ? undefined : session.inputValues().get(seed));
      clearFeedback();
      for (const control of controls()) {
        control.disabled = false;
        if (control.type === 'text') control.value = '';
        else control.checked = false;
      }
      status.textContent = '';
      checked = false;
      button.textContent = checkLabel;
      controls()[0]?.focus();
    };
    const onClick = (): void => { if (checked) retry(); else check(); };
    button.addEventListener('click', onClick);
    button.disabled = false;
    cleanups.push(() => button.removeEventListener('click', onClick));
  }
  return () => { for (const cleanup of cleanups) cleanup(); };
}
