import { createSession, formatNumber, parse, parseFormat, type Format, type Limits, type Program, type Result, type Session } from '@vchernoy/calc';
import { katexSettings, placeholders, substitute, type MathOutput } from '@vchernoy/remark-active/tex';
import type katex from 'katex';

type Katex = Pick<typeof katex, 'renderToString'>;

export type MountOptions = {
  /** Locale for formatting values; should match the one used to render. */
  locale?: string;
  /** Math output; should match the one used to render. */
  output?: MathOutput;
  limits?: Limits;
  /** How to load KaTeX, which is needed only when a formula's values change. Default: `import('katex')`. */
  loadKatex?: () => Promise<Katex>;
};

export type Mounted = {
  session: Session;
  program: Program;
  /** Resolves after formulas re-rendered for the latest change (useful in tests). */
  settled(): Promise<void>;
  /** Remove listeners; the page keeps its current state. */
  destroy(): void;
};

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
  const views: View[] = [];
  const cleanups: (() => void)[] = [];
  let pending: Promise<void> = Promise.resolve();
  let katexPromise: Promise<Katex> | undefined;
  const loadKatex = () => (katexPromise ??= (options.loadKatex ?? (async () => (await import('katex')).default))());

  // Views: <output data-active-value="expr" data-active-format="…">
  for (const el of doc.querySelectorAll<HTMLElement>('[data-active-value]')) {
    const compiled = session.compile(el.dataset.activeValue ?? '', 'value');
    if (compiled.diagnostics.length) continue; // the renderer already showed this error
    const format = parseFormat(el.dataset.activeFormat);
    if (typeof format === 'string') continue;
    views.push({ el, deps: compiled.deps, update: () => showResult(el, compiled.evaluate(), format, options.locale) });
  }

  // Formulas: <span|div data-active-tex="…{{expr}}…">, only those that use values.
  for (const el of doc.querySelectorAll<HTMLElement>('[data-active-tex]')) {
    const tex = el.dataset.activeTex ?? '';
    const exprs = placeholders(tex).map(e => session.compile(e, 'math'));
    if (!exprs.length) continue;
    const deps = new Set(exprs.flatMap(c => [...c.deps]));
    const display = el.dataset.activeDisplay === 'true';
    views.push({
      el, deps,
      update: () => {
        const source = substitute(tex, exprs.map(c => c.evaluate()));
        pending = pending.then(async () => {
          const k = await loadKatex();
          if (el.isConnected) el.innerHTML = k.renderToString(source, katexSettings(display, options.output));
        }).catch(() => { /* keep the last rendering if KaTeX can't load */ });
      },
    });
  }

  const unsubscribe = session.subscribe(changed => {
    for (const v of views) if (intersects(v.deps, changed)) v.update();
  });
  cleanups.push(unsubscribe);

  // Controls: <input data-active-input="name">
  for (const input of doc.querySelectorAll<HTMLInputElement>('input[data-active-input]')) {
    const name = input.dataset.activeInput ?? '';
    if (!program.inputs.some(i => i.name === name)) continue;
    const apply = () => {
      const value = input.valueAsNumber;
      const problem = Number.isNaN(value) ? 'enter a number' : session.set(name, value);
      input.setCustomValidity(problem ?? '');
      if (problem) {
        input.setAttribute('aria-invalid', 'true');
        input.title = problem;
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('title');
      }
    };
    input.addEventListener('input', apply);
    cleanups.push(() => input.removeEventListener('input', apply));
    // The browser may have restored a different value (back/forward cache, autofill): adopt it.
    const current = session.get(name);
    if (!Number.isNaN(input.valueAsNumber) && (current?.kind !== 'value' || current.value !== input.valueAsNumber)) apply();
  }

  return {
    session,
    program,
    settled: () => pending,
    destroy: () => { for (const c of cleanups.splice(0)) c(); },
  };
}

function showResult(el: HTMLElement, result: Result, format: Format, locale: string | undefined): void {
  const text = result.kind === 'value' ? formatNumber(result.value, format, locale) : `⚠ ${result.message}`;
  if (el.textContent !== text) el.textContent = text;
  el.classList.toggle('active-error', result.kind === 'error');
}
