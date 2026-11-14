import { mount, type Mounted } from '@vchernoy/active-runtime';
import { renderActive, type RenderMessage } from '@vchernoy/remark-active';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { SAMPLE } from './sample';
import { decodeDocument, encodeDocument } from './share';
import './style.css';

const STORE_KEY = 'active-md.playground.source.v1';
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
  showProblems(renderActive(source.value, { locale, output }).messages);
}

function showView(): void {
  live?.destroy();
  const { html } = renderActive(source.value, { locale, output });
  doc.innerHTML = html; // sanitized by the renderer: raw HTML dropped, rehype-sanitize, KaTeX with trust: false
  live = mount(doc, { locale, output, loadKatex: async () => katex });
}

function setMode(next: 'edit' | 'view', focus = true): void {
  mode = next;
  editButton.setAttribute('aria-pressed', String(next === 'edit'));
  viewButton.setAttribute('aria-pressed', String(next === 'view'));
  editPane.hidden = next !== 'edit';
  viewPane.hidden = next !== 'view';
  document.body.dataset.mode = next;
  if (next === 'view') {
    showView();
  } else {
    live?.destroy();
    live = undefined;
    check();
    if (focus) source.focus();
  }
}

let pendingCheck: number | undefined;
source.addEventListener('input', () => {
  // Once edited, the page is no longer the shared link's document.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
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

$('sample').addEventListener('click', () => {
  if (source.value !== SAMPLE && source.value.trim() && !confirm('Replace your text with the example?')) return;
  source.value = SAMPLE;
  save();
  setMode(mode, false);
  say('Example loaded.');
});

$('share').addEventListener('click', async () => {
  try {
    const hash = await encodeDocument(source.value);
    history.replaceState(null, '', hash);
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      say(`Link copied (${url.length.toLocaleString(locale)} characters). Anyone with it sees this document.`);
    } catch {
      say('Link is in the address bar; copy it from there.');
    }
  } catch {
    say('This browser can\'t make share links.');
  }
});

async function start(): Promise<void> {
  let text = stored() ?? SAMPLE;
  let shared = false;
  try {
    const fromLink = await decodeDocument(location.hash);
    if (fromLink !== undefined) { text = fromLink; shared = true; }
  } catch {
    say('That share link is damaged; showing your last document instead.');
  }
  source.value = text;
  // A shared link opens as a page; your own document opens for editing.
  setMode(shared ? 'view' : 'edit', false);
  if (shared) say('Opened a shared document. Editing it replaces the document saved in this browser.');
}

void start();
