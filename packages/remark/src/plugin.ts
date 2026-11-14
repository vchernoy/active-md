import { createSession, formatNumber, parse, parseFormat, type Diagnostic, type Format, type Limits, type Program, type Result } from '@vchernoy/calc';
import type { ElementContent } from 'hast';
import type { Code, Paragraph, Parent, Root, RootContent } from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import type { InlineMath, Math } from 'mdast-util-math';
import { toString } from 'mdast-util-to-string';
import type { VFile } from 'vfile';
import { mathBinding, PLACEHOLDER, substitute } from './tex.js';

export type ActiveOptions = {
  /** Locale for formatting values (default: the runtime's). */
  locale?: string;
  /** Keep calc blocks in the output as code (an author's view). Default false: readers don't see them. */
  showCalc?: boolean;
  limits?: Limits;
};

export type CalcBlock = { id: string; text: string };

/** What the plugin leaves on `file.data.active`. */
export type ActiveData = { blocks: CalcBlock[]; program: Program };

declare module 'vfile' {
  interface DataMap { active: ActiveData }
}

const CALLOUTS: Record<string, string> = {
  note: 'Note', tip: 'Tip', warning: 'Warning', danger: 'Danger', important: 'Important', exercise: 'Exercise',
};

type Directive = TextDirective | LeafDirective | ContainerDirective;

/**
 * remark plugin: collects ```calc blocks into one program, turns :input/:value directives into
 * controls and views showing default values, marks {{…}} in math, and adds callouts and :::details.
 * Use after remark-directive and remark-math. Diagnostics are vfile messages with document positions.
 */
export function remarkActive(options: ActiveOptions = {}) {
  return (tree: Root, file: VFile): void => {
    const blocks: CalcBlock[] = [];
    const blockStart = new Map<string, number>();
    /** Per block, the number of source characters (indentation, "> ") Markdown removed before each line. */
    const blockIndent = new Map<string, number[]>();
    const sourceLines = String(file.value).split(/\r?\n/);
    walk(tree, (node, parent, index) => {
      if (node.type !== 'code' || (node as Code).lang !== 'calc') return;
      const id = `calc-${blocks.length + 1}`;
      blocks.push({ id, text: (node as Code).value });
      // The block's text starts on the line after the opening fence.
      const first = (node.position?.start.line ?? 1) + 1;
      blockStart.set(id, first);
      blockIndent.set(id, (node as Code).value.split('\n').map((text, i) => {
        const line = sourceLines[first - 1 + i] ?? '';
        return text && line.endsWith(text) ? line.length - text.length : 0;
      }));
      // Shown as an ordinary `language-calc` code block.
      if (options.showCalc) return;
      parent.children.splice(index, 1);
      return index;
    });

    const program = parse(blocks, options.limits);
    const session = createSession(program, options.limits);
    file.data.active = { blocks, program };
    const report = (d: Pick<Diagnostic, 'message' | 'severity'>, place: { line: number; column: number } | undefined) => {
      const m = file.message(d.message, place ? { place } : undefined);
      m.source = 'active-md';
      m.ruleId = d.severity;
    };
    for (const d of program.diagnostics) {
      const start = blockStart.get(d.span.block);
      const indent = blockIndent.get(d.span.block)?.[d.span.line - 1] ?? 0;
      report(d, start === undefined ? undefined : { line: start + d.span.line - 1, column: d.span.column + indent });
    }

    /** The range of the first control of each input; later controls of the same input must match it. */
    const controlled = new Map<string, { lo: number | undefined; hi: number | undefined; line: number | undefined }>();
    walk(tree, (node, parent, index) => {
      if (node.type === 'textDirective' || node.type === 'leafDirective' || node.type === 'containerDirective') {
        return directive(node as Directive, parent, index);
      }
      if (node.type === 'math' || node.type === 'inlineMath') math(node as Math | InlineMath);
      return undefined;
    });

    function at(node: { position?: { start: { line: number; column: number } } | undefined }) {
      return node.position ? { line: node.position.start.line, column: node.position.start.column } : undefined;
    }

    function showError(node: TextDirective, message: string): void {
      report({ message, severity: 'error' }, at(node));
      node.data = { hName: 'span', hProperties: { className: ['active-error'], role: 'note' }, hChildren: [{ type: 'text', value: `⚠ ${message}` }] };
    }

    function directive(node: Directive, parent: Parent, index: number): number | undefined {
      const attrs = node.attributes ?? {};
      if (node.type === 'textDirective' && node.name === 'input') { input(node, attrs); return undefined; }
      if (node.type === 'textDirective' && node.name === 'value') { value(node, attrs); return undefined; }
      if (node.type === 'containerDirective' && (Object.hasOwn(CALLOUTS, node.name) || node.name === 'details')) {
        container(node);
        return undefined;
      }
      // Anything else (":30" in "10:30" is not a directive, but "Note:this" is) goes back to its source text.
      const source = sourceOf(node, file);
      const text: RootContent = { type: 'text', value: source };
      const replacement = node.type === 'textDirective' ? text : ({ type: 'paragraph', children: [{ type: 'text', value: source }] } satisfies Paragraph);
      parent.children.splice(index, 1, replacement as never);
      return index + 1;
    }

    function input(node: TextDirective, attrs: Record<string, string | null | undefined>): void {
      const name = labelSource(node, file).trim();
      const def = program.inputs.find(i => i.name === name);
      const fail = (message: string) => showError(node, message);
      if (!def) return fail(program.names.has(name) ? `"${name}" is not an input, so it can't have a control` : `unknown input "${name}"`);
      const widget = attrs.widget ?? 'number';
      if (widget !== 'number' && widget !== 'slider') return fail(`unknown widget "${widget}" (use number or slider)`);
      const num = (key: string): number | undefined | string => {
        const raw = attrs[key];
        if (raw === undefined || raw === null || raw === '') return undefined;
        const n = Number(raw);
        return Number.isFinite(n) ? n : `${key}="${raw}" is not a number`;
      };
      const min = num('min'), max = num('max'), step = num('step');
      for (const v of [min, max, step]) if (typeof v === 'string') return fail(v);
      const lo = (min as number | undefined) ?? def.range?.min;
      const hi = (max as number | undefined) ?? def.range?.max;
      if (def.range && ((lo !== undefined && lo < def.range.min) || (hi !== undefined && hi > def.range.max)))
        return fail(`min/max can only narrow ${name}'s range ${def.range.min}..${def.range.max}`);
      if (widget === 'slider' && (lo === undefined || hi === undefined)) return fail(`a slider needs a range: give ${name} "in a..b" or min and max`);
      if (lo !== undefined && hi !== undefined && lo > hi) return fail(`min ${lo} is greater than max ${hi}`);
      if (step !== undefined && (step as number) <= 0) return fail('step must be positive');
      // Several controls may edit one input (a number box and a slider); they stay in sync, so they must agree on the range.
      const first = controlled.get(name);
      if (first && (first.lo !== lo || first.hi !== hi)) {
        const range = (a: number | undefined, b: number | undefined) => `${a ?? '…'}..${b ?? '…'}`;
        return fail(`every control of ${name} must use the same range: ${range(first.lo, first.hi)}${first.line ? ` (line ${first.line})` : ''}, not ${range(lo, hi)}`);
      }
      const current = session.get(name);
      const shown = current?.kind === 'value' ? current.value : def.default;
      // The browser would silently clamp a value outside the control, and the page would disagree with the model.
      if ((lo !== undefined && shown < lo) || (hi !== undefined && shown > hi))
        return fail(`${name} starts at ${shown}, outside this control's range ${lo ?? '…'}..${hi ?? '…'}`);
      // A control whose step can't land on the starting value would snap it, and the page would disagree
      // with the model. An explicit step must fit; an inferred slider step falls back to "any".
      // HTML measures steps from min, or from the value attribute when there is no min.
      const base = lo ?? shown;
      if (step !== undefined && !onStep(shown, base, step as number))
        return fail(`${name} starts at ${shown}, which step ${step} from ${base} can't reach`);
      const inferred = widget === 'slider' ? sliderStep(lo!, hi!) : undefined;
      const controlStep: number | string = (step as number | undefined) ?? (inferred !== undefined && onStep(shown, base, inferred) ? inferred : 'any');
      const label = attrs.label ?? undefined;
      const props: Record<string, string | number> = {
        type: widget === 'slider' ? 'range' : 'number', value: String(shown), dataActiveInput: name,
        ...(lo !== undefined ? { min: lo } : {}), ...(hi !== undefined ? { max: hi } : {}),
        step: controlStep,
        ...(label ? {} : { ariaLabel: name }),
      };
      const children: ElementContent[] = [];
      if (label) children.push({ type: 'element', tagName: 'span', properties: { className: ['active-input-label'] }, children: [{ type: 'text', value: label }] });
      children.push({ type: 'element', tagName: 'input', properties: props, children: [] });
      if (widget === 'slider') {
        children.push({ type: 'element', tagName: 'output', properties: { className: ['active-value'], dataActiveValue: name, ariaLive: 'polite' }, children: [{ type: 'text', value: formatNumber(shown, undefined, options.locale) }] });
      }
      if (!first) controlled.set(name, { lo, hi, line: node.position?.start.line });
      node.data = { hName: 'label', hProperties: { className: ['active-input', `active-input-${widget}`] }, hChildren: children };
    }

    function value(node: TextDirective, attrs: Record<string, string | null | undefined>): void {
      const expr = labelSource(node, file).trim();
      const format = parseFormat(attrs.format ?? undefined);
      const compiled = session.compile(expr, 'value');
      const problem = typeof format === 'string' ? format : compiled.diagnostics[0]?.message;
      if (problem) return showError(node, problem);
      const result = compiled.evaluate();
      node.data = {
        hName: 'output',
        hProperties: { className: ['active-value', ...(result.kind === 'error' ? ['active-error'] : [])], dataActiveValue: expr, ...(attrs.format ? { dataActiveFormat: attrs.format } : {}), ariaLive: 'polite' },
        hChildren: [{ type: 'text', value: show(result, format as Format) }],
      };
    }

    function show(result: Result, format: Format): string {
      return result.kind === 'value' ? formatNumber(result.value, format, options.locale) : `⚠ ${result.message}`;
    }

    function container(node: ContainerDirective): void {
      const first = node.children[0];
      let title: string | undefined;
      if (first?.type === 'paragraph' && first.data && (first.data as { directiveLabel?: boolean }).directiveLabel) {
        title = toString(first);
        node.children.shift();
      }
      if (node.name === 'details') {
        node.children.unshift({ type: 'paragraph', data: { hName: 'summary' }, children: [{ type: 'text', value: title ?? 'Details' }] });
        node.data = { hName: 'details' };
        return;
      }
      node.children.unshift({ type: 'paragraph', data: { hProperties: { className: ['callout-title'] } }, children: [{ type: 'text', value: title ?? CALLOUTS[node.name]! }] });
      node.data = { hName: 'aside', hProperties: { className: ['callout', `callout-${node.name}`], role: 'note' } };
    }

    function math(node: Math | InlineMath): void {
      // `$$…$$` written inside a line is inline math to remark-math, but authors mean display math.
      const start = node.position?.start.offset;
      const display = node.type === 'math' || (start !== undefined && String(file.value).startsWith('$$', start));
      const exprs = [...node.value.matchAll(PLACEHOLDER)].map(m => m[1]!.trim());
      const results: Result[] = exprs.map(e => {
        const binding = mathBinding(e);
        const c = session.compile(binding.expression, 'math');
        const r = c.evaluate();
        // The formula only shows a red "?", so the author needs the reason: a compile or an evaluation error.
        const problem = binding.problem ?? c.diagnostics[0]?.message ?? (r.kind === 'error' ? r.message : undefined);
        if (problem) report({ message: `in {{${e}}}: ${problem}`, severity: 'error' }, at(node));
        return r;
      });
      node.data = {
        hName: node.type === 'math' ? 'div' : 'span',
        hProperties: { className: ['active-math', display ? 'active-math-display' : 'active-math-inline'], dataActiveTex: node.value, ...(display ? { dataActiveDisplay: 'true' } : {}) },
        hChildren: [{ type: 'text', value: substitute(node.value, results, options.locale) }],
      };
    }
  };
}

/** Whether value = base + k·step for a whole k (within floating-point noise). */
function onStep(value: number, base: number, step: number): boolean {
  const k = (value - base) / step;
  return Math.abs(k - Math.round(k)) < 1e-9;
}

/** A slider step that gives about 100 positions, rounded to 1, 2 or 5 × 10^k. */
function sliderStep(min: number, max: number): number {
  const raw = (max - min) / 100;
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return Number(((m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p).toPrecision(12));
}

/**
 * The directive label exactly as written. The label is parsed as Markdown, so `:value[2*3*4]` has an
 * emphasis child; flattening it to text would drop the operators. Use the source between the children.
 */
function labelSource(node: TextDirective, file: VFile): string {
  const first = node.children[0]?.position?.start.offset;
  const last = node.children[node.children.length - 1]?.position?.end.offset;
  if (first === undefined || last === undefined) return toString(node);
  return String(file.value).slice(first, last);
}

function sourceOf(node: Directive, file: VFile): string {
  const start = node.position?.start.offset, end = node.position?.end.offset;
  if (start !== undefined && end !== undefined) return String(file.value).slice(start, end);
  return `:${node.name}${toString(node) ? `[${toString(node)}]` : ''}`;
}

/** Depth-first walk over mdast parents; the visitor may splice and return the next index. */
function walk(tree: Root, visit: (node: RootContent, parent: Parent, index: number) => number | undefined): void {
  const go = (parent: Parent): void => {
    for (let i = 0; i < parent.children.length;) {
      const node = parent.children[i]!;
      const next = visit(node, parent, i);
      if (next !== undefined) { i = next; continue; }
      if ('children' in node) go(node as Parent);
      i++;
    }
  };
  go(tree);
}
