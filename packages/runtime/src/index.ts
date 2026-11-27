import { inputWidth } from './input-width.js';
import { mountQuizzes, type QuizSeedSource } from './quiz-ui.js';
import type { CompletedQuizAttempt } from './quiz-attempt.js';
import { createSession, formatNumber, parse, parseFormat, type Format, type Limits, type Program, type Result, type Session } from '@vchernoy/calc';
import { katexSettings, placeholders, substitute, type MathOutput } from '@vchernoy/remark-active/tex';
import type katex from 'katex';

let nextProblemId = 0;
let nextRadioGroupId = 0;

type Katex = Pick<typeof katex, 'renderToString'>;

export type MountOptions = {
  /** Locale for formatting values; should match the one used to render. */
  locale?: string;
  /** Math output; should match the one used to render. */
  output?: MathOutput;
  limits?: Limits;
  /** Validated reader values applied before the first refresh; accepted entries override browser autofill. */
  initialInputs?: ReadonlyMap<string, number>;
  /** How to load KaTeX, which is needed only when a formula's values change. Default: `import('katex')`. */
  loadKatex?: () => Promise<Katex>;
  /**
   * The `quiz` manifest from `renderActive(source, { quizManifest: true })` (#48). With it, rendered
   * quiz groups get Check / Retry; without it (or if it does not fit this document) they stay inert.
   */
  quiz?: unknown;
  /**
   * Entropy for seeded quiz attempts: a uniform integer in `[0, size)`. Default: the platform
   * CSPRNG. Supply your own for reproducible attempts (tests, proctored hosts).
   */
  quizSeedSource?: QuizSeedSource;
  /** Synchronous completed self-check notification; detached/frozen, no answer key or restore. */
  onQuizAttempt?: (attempt: CompletedQuizAttempt) => void;
};

export type Mounted = {
  session: Session;
  program: Program;
  /** Resolves after formulas re-rendered for the latest change (useful in tests). */
  settled(): Promise<void>;
  /** Restore authored defaults, synchronize all controls and clear stale validation errors. */
  resetInputs(): void;
  /** Remove listeners; the page keeps its current state. */
  destroy(): void;
};

type Control = HTMLInputElement | HTMLSelectElement | HTMLFieldSetElement;

const isSelect = (input: Control): input is HTMLSelectElement => input.tagName === 'SELECT';
const isRadioGroup = (input: Control): input is HTMLFieldSetElement => input.tagName === 'FIELDSET';
const radioOptions = (group: HTMLFieldSetElement) => [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

function controlValue(input: Control): number {
  if (isRadioGroup(input)) return Number(radioOptions(input).find(option => option.checked)?.value ?? NaN);
  if (isSelect(input)) return input.value === '' ? NaN : Number(input.value);
  return input.valueAsNumber;
}

function differsFromDefault(input: Control): boolean {
  if (isRadioGroup(input)) return radioOptions(input).some(option => option.checked !== option.defaultChecked);
  if (isSelect(input)) return input.value !== ([...input.options].find(option => option.defaultSelected)?.value ?? '');
  return input.value !== input.defaultValue;
}

function writeControl(input: Control, value: number): void {
  if (isRadioGroup(input)) {
    for (const option of radioOptions(input)) option.checked = Number(option.value) === value;
  } else {
    input.value = String(value);
  }
}

type View = { el: HTMLElement; deps: ReadonlySet<string>; update(): void };

const intersects = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some(x => b.has(x));

/** Read the calc sources the renderer left on the document root. Anything malformed means "no calc". */
function readBlocks(doc: HTMLElement): { id: string; text: string }[] {
  try {
    const raw: unknown = JSON.parse(doc.dataset.activeCalc ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((t): t is string => typeof t === 'string').map((text, i) => ({ id: `calc-${i + 1}`, text }));
  } catch {
    return [];
  }
}

/**
 * Make a document rendered by @vchernoy/remark-active live. `root` is the `.active-doc` element or
 * contains it. Controls update the session; only views and formulas whose inputs changed are redrawn.
 */
export function mount(root: HTMLElement, options: MountOptions = {}): Mounted {
  const doc = root.matches('.active-doc') ? root : root.querySelector<HTMLElement>('.active-doc');
  if (!doc) throw new Error('active-md: no .active-doc element to mount');
  const program = parse(readBlocks(doc), options.limits);
  const session = createSession(program, options.limits);
  const controls = new Map<string, Control[]>();
  const problems = new Map<Control, HTMLElement>();
  const clearProblem = (input: Control): void => {
    input.setCustomValidity('');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('title');
    const message = problems.get(input);
    if (message) message.textContent = '';
  };

  const inputNames = new Set(program.inputs.map(input => input.name));
  for (const input of doc.querySelectorAll<Control>('input[data-active-input], select[data-active-input], fieldset[data-active-input]')) {
    const name = input.dataset.activeInput ?? '';
    if (!inputNames.has(name)) continue;
    if (isRadioGroup(input)) {
      // Names are assigned per instance so separately mounted copies never uncheck one another.
      let groupName: string;
      do { groupName = `active-radio-${++nextRadioGroupId}`; }
      while (input.ownerDocument.getElementsByName(groupName).length);
      for (const option of radioOptions(input)) option.name = groupName;
    }
    controls.set(name, [...(controls.get(name) ?? []), input]);
  }
  // Choice domains constrain this mounted session, including host setters and numeric peers.
  // Pure calc sessions retain their model range; widgets do not alter compiler proofs.
  const setInput = session.set.bind(session);
  session.set = (name, value) => {
    for (const input of controls.get(name) ?? []) {
      if (isSelect(input) || isRadioGroup(input)) {
        const problem = outsideControl(input, value);
        if (problem) return problem;
      }
    }
    return setInput(name, value);
  };
  // Initialize before exposing the session or refreshing views. Iterate declared inputs,
  // not an unbounded host snapshot; include inputs that have no rendered controls.
  const initialAccepted = new Set<string>();
  const initialChanges = new Set<string>();
  const stopInitialCollection = session.subscribe(changed => { for (const name of changed) initialChanges.add(name); });
  for (const { name } of program.inputs) {
    const value = options.initialInputs?.get(name);
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if ((controls.get(name) ?? []).some(input => outsideControl(input, value))) continue;
    if (!session.set(name, value)) initialAccepted.add(name);
  }
  stopInitialCollection();
  const initialValues = session.inputValues();
  const views: View[] = [];
  const cleanups: (() => void)[] = [];
  let pending: Promise<void> = Promise.resolve();
  let destroyed = false;
  let katexPromise: Promise<Katex> | undefined;
  const loadKatex = () => (katexPromise ??= (options.loadKatex ?? (async () => (await import('katex')).default))());

  // Views: <output data-active-value="expr" data-active-format="…">
  for (const el of doc.querySelectorAll<HTMLElement>('[data-active-value]')) {
    const compiled = session.compile(el.dataset.activeValue ?? '', 'value');
    const format = parseFormat(el.dataset.activeFormat);
    views.push({ el, deps: compiled.deps, update: () => showResult(el, typeof format === 'string' ? { kind: 'error', message: format } : compiled.evaluate(), typeof format === 'string' ? { kind: 'auto' } : format, options.locale) });
  }

  // Formulas: <span|div data-active-tex="…{{expr}}…">, only those that use values.
  for (const el of doc.querySelectorAll<HTMLElement>('[data-active-tex]')) {
    const tex = el.dataset.activeTex ?? '';
    const exprs = placeholders(tex).map(e => session.compile(e, 'math'));
    if (!exprs.length && !el.closest('[data-active-when]')) continue;
    const deps = new Set(exprs.flatMap(c => [...c.deps]));
    const display = el.dataset.activeDisplay === 'true';
    views.push({
      el, deps,
      update: () => {
        const source = substitute(tex, exprs.map(c => c.evaluate()), options.locale);
        pending = pending.then(async () => {
          const k = await loadKatex();
          // A destroyed mount must not touch the page (a newer mount may own these elements now).
          // Detached roots still update: the host may insert the document later.
          if (!destroyed && !el.closest('[data-active-when][hidden]')) el.innerHTML = k.renderToString(source, katexSettings(display, options.output));
        }).catch(() => { /* keep the last rendering if KaTeX can't load */ });
      },
    });
  }

  /** Every control of each input: a number box and a slider may edit the same input and stay in sync. */
  let editing: Control | undefined;
  const conditionErrors = new Map([...doc.querySelectorAll<HTMLElement>('[data-active-when-error]')].map(el => [el.dataset.activeWhenError, el]));
  const conditions = [...doc.querySelectorAll<HTMLElement>('[data-active-when]')].map(el => ({ el, compiled: session.compile(el.dataset.activeWhen ?? '', 'when') }));
  const wasVisible = new WeakMap<HTMLElement, boolean>();
  for (const v of views) wasVisible.set(v.el, !v.el.closest('[data-active-when][hidden]'));
  const refresh = (changed: ReadonlySet<string>, initial = false): void => {
    for (const { el, compiled } of conditions) {
      const parent = el.parentElement?.closest('[data-active-when]');
      let depth = 1;
      for (let p = parent; p; p = p.parentElement?.closest('[data-active-when]') ?? null) depth++;
      const allowed = !el.parentElement?.closest('[data-active-when][hidden]') && depth <= 8 && el.dataset.activeWhenDisabled !== 'true';
      const r = allowed ? compiled.evaluate() : undefined;
      const problem = r?.kind === 'error' ? r.message : undefined;
      el.hidden = !allowed || r?.kind !== 'value' || r.value === 0;
      const error = conditionErrors.get(el.dataset.activeWhenId);
      if (error) { error.hidden = !problem; error.textContent = problem ? `⚠ ${problem}` : ''; }
    }
    for (const v of views) {
      const visible = !v.el.closest('[data-active-when][hidden]');
      if (visible && (!wasVisible.get(v.el) || (!initial && intersects(v.deps, changed)))) v.update();
      wasVisible.set(v.el, visible);
    }
  };
  refresh(initialChanges, initialChanges.size === 0);
  const unsubscribe = session.subscribe(changed => {
    refresh(changed);
    // Public session setters/reset must update controls too. Preserve the active edit's
    // text/caret; peers and programmatic changes show the accepted model value.
    for (const name of changed) syncPeers(name, editing);
  });
  cleanups.push(unsubscribe);

  /**
   * After any accepted submission (even of the current value), show the input's value in every other control and
   * clear their stale errors. The control the reader is editing is never rewritten under the cursor. A slider
   * whose step can't represent the value shows the nearest position; the model and the readout keep the value.
   */
  const syncPeers = (name: string, editing?: Control): void => {
    const r = session.get(name);
    if (r?.kind !== 'value') return;
    for (const other of controls.get(name) ?? []) {
      if (other === editing) continue;
      if (controlValue(other) !== r.value) writeControl(other, r.value);
      clearProblem(other);
    }
  };

  const restorable: { name: string; input: Control; apply: () => boolean }[] = [];
  // Each numeric control or choice group updates one declared input.
  for (const [name, inputs] of controls) for (const input of inputs) {
    const message = input.ownerDocument.createElement('span');
    do { message.id = `active-input-problem-${++nextProblemId}`; }
    while (input.ownerDocument.getElementById(message.id));
    message.className = 'active-input-problem';
    message.setAttribute('aria-live', 'polite');
    message.setAttribute('aria-atomic', 'true');
    (input.closest('label') ?? input).insertAdjacentElement('afterend', message);
    const describedBy = input.getAttribute('aria-describedby');
    input.setAttribute('aria-describedby', [describedBy, message.id].filter(Boolean).join(' '));
    problems.set(input, message);
    cleanups.push(() => {
      clearProblem(input);
      const ids = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== message.id);
      if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
      else input.removeAttribute('aria-describedby');
      message.remove();
      problems.delete(input);
    });
    if (!isSelect(input) && !isRadioGroup(input) && input.type === 'number') input.style.setProperty('--active-input-ch', String(inputWidth(input.min, input.max, input.defaultValue, input.step)));
    const initialValue = initialValues.get(name);
    if (initialAccepted.has(name) && initialValue !== undefined) writeControl(input, initialValue);
    const apply = () => {
      const value = controlValue(input);
      let problem: string | undefined;
      editing = input;
      try { problem = Number.isNaN(value) ? 'enter a number' : outsideControl(input, value) ?? session.set(name, value); }
      finally { editing = undefined; }
      if (problem) {
        if (isRadioGroup(input)) {
          syncPeers(name);
          return false;
        }
        input.setCustomValidity(problem);
        input.setAttribute('aria-invalid', 'true');
        input.title = problem;
        message.textContent = `${problem}. Results use the last accepted value.`;
        return false;
      }
      clearProblem(input);
      syncPeers(name, input);
      return true;
    };
    const event = isSelect(input) || isRadioGroup(input) ? 'change' : 'input';
    input.addEventListener(event, apply);
    cleanups.push(() => input.removeEventListener(event, apply));
    restorable.push({ name, input, apply });
  }

  // The browser may have restored a value (back/forward cache, autofill): adopt it. A control counts as restored
  // if its value differs from what was rendered, decided before anything is applied, so values written by syncing
  // (a slider rounded to its step, say) are never mistaken for restored ones. One restored control per input wins.
  const restored = restorable.filter(({ name, input }) => !initialAccepted.has(name) && !Number.isNaN(controlValue(input)) && differsFromDefault(input));
  const adopted = new Set<string>();
  for (const { name, apply } of restored) {
    if (adopted.has(name)) continue;
    if (apply()) adopted.add(name);
  }

  // Empty edits cannot adopt a model value or suppress a valid restored peer.
  // If no peer was accepted, retain the edit and explain the unchanged model.
  for (const { name, input, apply } of restorable) {
    if (!initialAccepted.has(name) && !adopted.has(name) && Number.isNaN(controlValue(input))) apply();
  }

  if (options.quiz !== undefined) cleanups.push(mountQuizzes(doc, options.quiz, session, options.quizSeedSource, options.onQuizAttempt));

  return {
    session,
    program,
    settled: () => pending,
    resetInputs: () => {
      if (destroyed) return;
      session.reset();
      // Even if the model already equals defaults, invalid unfinished control text
      // and its browser validity state must be reset explicitly.
      for (const name of controls.keys()) syncPeers(name);
    },
    destroy: () => {
      destroyed = true;
      for (const c of cleanups.splice(0)) c();
    },
  };
}

/** A control may narrow the input's range (min/max attributes); the session only knows the model's range. */
function outsideControl(input: Control, value: number): string | undefined {
  if (isRadioGroup(input)) return radioOptions(input).some(option => Number(option.value) === value) ? undefined : 'choose an available option';
  if (isSelect(input)) return [...input.options].some(option => Number(option.value) === value) ? undefined : 'choose an available option';
  const min = input.min === '' ? -Infinity : Number(input.min);
  const max = input.max === '' ? Infinity : Number(input.max);
  if (value >= min && value <= max) return undefined;
  if (Number.isFinite(min) && Number.isFinite(max)) return `enter a number from ${min} to ${max}`;
  return Number.isFinite(min) ? `enter a number of at least ${min}` : `enter a number of at most ${max}`;
}

function showResult(el: HTMLElement, result: Result, format: Format, locale: string | undefined): void {
  const text = result.kind === 'value' ? formatNumber(result.value, format, locale) : `⚠ ${result.message}`;
  if (el.textContent !== text) el.textContent = text;
  el.classList.toggle('active-error', result.kind === 'error');
}

export { inspectQuizManifest, type QuizManifestInspection } from './quiz-manifest.js';
export { compileQuizManifest, type QuizCompilation } from './quiz-compile.js';
export { checkQuizGroup, type QuizResponses, type QuizGroupCheck } from './quiz-check.js';
export type { CompletedQuizAttempt, CompletedQuizResponse } from './quiz-attempt.js';
export type { QuizSeedSource } from './quiz-ui.js';
export { ACTIVE_STYLES, activeStyle, type ActiveStyle } from './styles.js';
