import { ACTIVE_STYLES, activeStyle, mount, type ActiveStyle, type Mounted } from '@vchernoy/active-runtime';
import { renderActive, type RenderMessage } from '@vchernoy/remark-active';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { watchMathScroll } from './math-scroll';
import { SAMPLE } from './sample';
import { decodeDocument, DocumentTooLarge, MAX_DOCUMENT_BYTES, shareLink } from './share';
import '@vchernoy/active-runtime/style.css';
import '@vchernoy/active-runtime/styles.css';
import './style.css';

const STORE_KEY = 'active-md.playground.source.v1';
const STYLE_KEY = 'active-md.playground.style.v1';
const LEGACY_SKETCH_KEY = 'active-md.playground.sketch.v1';
const locale = navigator.language || 'en-US';
// The page ships KaTeX's CSS and fonts (bundled, no network), so use its HTML output; MathML stays for screen readers.
const output = 'htmlAndMathml' as const;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const source = $<HTMLTextAreaElement>('source');
const editPane = $('edit-pane');
const viewPane = $('view-pane');
const doc = $('doc');
const problems = $<HTMLUListElement>('problems');
const problemsTitle = $('problems-title');
const status = $('status');
const editButton = $<HTMLButtonElement>('mode-edit');
const viewButton = $<HTMLButtonElement>('mode-view');

let live: Mounted | undefined;
let stopMathScroll: (() => void) | undefined;
let readerInputs: ReadonlyMap<string, number> | undefined;
let mode: 'edit' | 'view' = 'edit';

function say(text: string): void {
  status.textContent = text;
}

function save(): void {
  try { localStorage.setItem(STORE_KEY, source.value); } catch { /* storage may be blocked; editing still works */ }
}

function stored(): string | null {
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
}

function showProblems(messages: RenderMessage[]): void {
  problems.replaceChildren(...messages.map(m => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = m.severity;
    b.textContent = `${m.line ? `Line ${m.line}${m.column ? `:${m.column}` : ''} — ` : ''}${m.message}`;
    b.addEventListener('click', () => goTo(m.line, m.column));
    li.append(b);
    return li;
  }));
  problemsTitle.textContent = messages.length === 0 ? 'No problems' : messages.length === 1 ? '1 problem' : `${messages.length} problems`;
}

/** Put the caret at a line and column of the source. */
function goTo(line = 1, column = 1): void {
  const lines = source.value.split('\n');
  let at = 0;
  for (let i = 0; i < Math.min(line - 1, lines.length); i++) at += lines[i]!.length + 1;
  at += Math.max(0, column - 1);
  source.focus();
  source.setSelectionRange(at, at);
}

function check(): void {
  showProblems(renderActive(source.value, { locale, output, quizManifest: true }).messages);
}

function stopView(preserve = true): void {
  stopMathScroll?.();
  stopMathScroll = undefined;
  if (live && preserve) readerInputs = live.session.inputValues();
  live?.destroy();
  live = undefined;
  if (!preserve) readerInputs = undefined;
}

function showView(): void {
  stopView();
  // Quizzes (#48): the manifest goes to the runtime directly; answers never enter the HTML.
  const { html, quiz } = renderActive(source.value, { locale, output, quizManifest: true });
  doc.innerHTML = html; // sanitized by the renderer: raw HTML dropped, rehype-sanitize, KaTeX with trust: false
  live = mount(doc, { locale, output, ...(readerInputs ? { initialInputs: readerInputs } : {}), ...(quiz ? { quiz } : {}), loadKatex: async () => katex });
  stopMathScroll = watchMathScroll(doc, $('math-scroll-hint'));
}

function setMode(next: 'edit' | 'view', focus = true): void {
  mode = next;
  editButton.setAttribute('aria-pressed', String(next === 'edit'));
  viewButton.setAttribute('aria-pressed', String(next === 'view'));
  editPane.hidden = next !== 'edit';
  viewPane.hidden = next !== 'view';
  document.body.dataset.mode = next;
  $('reset-values').hidden = next !== 'view';
  if (next === 'view') {
    showView();
  } else {
    stopView();
    check();
    if (focus) source.focus();
  }
}

let pendingCheck: number | undefined;
/** Bumped on every change to the text, so a share link made from an older text is discarded. */
let revision = 0;
/** Once the text changes, the address bar must not keep pointing at an older shared document. */
function dropShareHash(): void {
  revision++;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

source.addEventListener('input', () => {
  stopView(false);
  dropShareHash();
  save();
  clearTimeout(pendingCheck);
  pendingCheck = window.setTimeout(check, 250);
});

editButton.addEventListener('click', () => setMode('edit'));
viewButton.addEventListener('click', () => setMode('view'));
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    setMode(mode === 'edit' ? 'view' : 'edit');
  }
});

// Optional document style (runtime styles.css): one attribute on the document's container, so it
// switches instantly and survives re-rendering. 0.12's Hand-drawn toggle becomes the "sketch" style.
const styleSelect = $<HTMLSelectElement>('doc-style');
for (const style of ACTIVE_STYLES) styleSelect.add(new Option(style.label, style.id));
function setStyle(style: ActiveStyle, remember = true): void {
  if (style === 'plain') delete doc.dataset.activeStyle;
  else doc.dataset.activeStyle = style;
  styleSelect.value = style;
  if (remember) {
    try { localStorage.setItem(STYLE_KEY, style); } catch { /* storage may be blocked; the choice still applies */ }
  }
}
let savedStyle: ActiveStyle = 'plain';
try {
  savedStyle = activeStyle(localStorage.getItem(STYLE_KEY) ?? (localStorage.getItem(LEGACY_SKETCH_KEY) === 'on' ? 'sketch' : 'plain'));
} catch { /* default: plain */ }
setStyle(savedStyle, false);
styleSelect.addEventListener('change', () => setStyle(activeStyle(styleSelect.value)));

$('sample').addEventListener('click', () => {
  if (source.value !== SAMPLE && source.value.trim() && !confirm('Replace your text with the example?')) return;
  stopView(false);
  source.value = SAMPLE;
  dropShareHash();
  save();
  setMode(mode, false);
  say('Example loaded.');
});

$('reset-values').addEventListener('click', () => {
  live?.resetInputs();
  readerInputs = undefined;
  say('Reader values reset to authored defaults.');
});

$('share').addEventListener('click', async () => {
  try {
    const hash = await shareLink(source.value, () => revision);
    if (hash === undefined) {
      say('The text changed while making the link; press Share link again.');
      return;
    }
    history.replaceState(null, '', hash);
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      say(`Link copied (${url.length.toLocaleString(locale)} characters). The link includes authored defaults, not current reader values.`);
    } catch {
      say('Link is in the address bar; copy it from there. It includes authored defaults, not current reader values.');
    }
  } catch (e) {
    say(e instanceof DocumentTooLarge
      ? `This document is too large for a link (${e.bytes.toLocaleString(locale)} bytes; the limit is ${MAX_DOCUMENT_BYTES.toLocaleString(locale)}).`
      : 'This browser can\'t make share links.');
  }
});

async function start(): Promise<void> {
  // Show the saved document at once; a shared link (decoded asynchronously) replaces it below.
  const saved = stored();
  source.value = saved ?? SAMPLE;
  const before = revision;
  let fromLink: string | undefined;
  try {
    fromLink = await decodeDocument(location.hash);
  } catch {
    say('That share link is damaged; showing your last document instead.');
  }
  // If the reader typed or loaded the example meanwhile, their text wins (their edit already dropped the hash).
  if (revision !== before) return;
  if (fromLink !== undefined) { stopView(false); source.value = fromLink; }
  // A shared link and a first visit (the example) open as a page, so newcomers see the
  // document working before its source; a document you saved in this browser opens for editing.
  setMode(fromLink !== undefined || saved === null ? 'view' : 'edit', false);
  if (fromLink !== undefined) say('Opened a shared document. Editing it replaces the document saved in this browser.');
}

void start();
