import { createSession, formatNumber, parse, parseFormat, type Diagnostic, type Format, type Limits, type Program, type Result } from '@vchernoy/calc';
import type { ElementContent } from 'hast';
import type { Code, Paragraph, Parent, Root, RootContent } from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import type { InlineMath, Math } from 'mdast-util-math';
import { toString } from 'mdast-util-to-string';
import type { VFile } from 'vfile';
import { placeholders, substitute } from './tex.js';

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
    walk(tree, (node, parent, index) => {
      if (node.type !== 'code' || (node as Code).lang !== 'calc') return;
      const id = `calc-${blocks.length + 1}`;
      blocks.push({ id, text: (node as Code).value });
      // The block's text starts on the line after the opening fence.
      blockStart.set(id, (node.position?.start.line ?? 1) + 1);
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
      report(d, start === undefined ? undefined : { line: start + d.span.line - 1, column: d.span.column });
    }

    const controlled = new Set<string>();
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
      const name = toString(node).trim();
      const def = program.inputs.find(i => i.name === name);
      const fail = (message: string) => showError(node, message);
      if (!def) return fail(program.names.has(name) ? `"${name}" is not an input, so it can't have a control` : `unknown input "${name}"`);
      if (controlled.has(name)) return fail(`"${name}" already has a control; show its value elsewhere with :value[${name}]`);
      controlled.add(name);
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
      if (step !== undefined && (step as number) <= 0) return fail('step must be positive');
      const current = session.get(name);
      const shown = current?.kind === 'value' ? current.value : def.default;
      const label = attrs.label ?? undefined;
      const props: Record<string, string | number> = {
        type: widget === 'slider' ? 'range' : 'number', value: String(shown), dataActiveInput: name,
        ...(lo !== undefined ? { min: lo } : {}), ...(hi !== undefined ? { max: hi } : {}),
        step: (step as number | undefined) ?? (widget === 'slider' ? sliderStep(lo!, hi!) : 'any'),
        ...(label ? {} : { ariaLabel: name }),
      };
      const children: ElementContent[] = [];
      if (label) children.push({ type: 'element', tagName: 'span', properties: { className: ['active-input-label'] }, children: [{ type: 'text', value: label }] });
      children.push({ type: 'element', tagName: 'input', properties: props, children: [] });
      if (widget === 'slider') {
        children.push({ type: 'element', tagName: 'output', properties: { className: ['active-value'], dataActiveValue: name, ariaLive: 'polite' }, children: [{ type: 'text', value: formatNumber(shown, undefined, options.locale) }] });
      }
      node.data = { hName: 'label', hProperties: { className: ['active-input', `active-input-${widget}`] }, hChildren: children };
    }

    function value(node: TextDirective, attrs: Record<string, string | null | undefined>): void {
      const expr = toString(node).trim();
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
      const exprs = placeholders(node.value);
      const results: Result[] = exprs.map(e => {
        const c = session.compile(e, 'math');
        if (c.diagnostics[0]) report({ message: `in {{${e}}}: ${c.diagnostics[0].message}`, severity: 'error' }, at(node));
        return c.evaluate();
      });
      node.data = {
        hName: node.type === 'math' ? 'div' : 'span',
        hProperties: { className: ['active-math', display ? 'active-math-display' : 'active-math-inline'], dataActiveTex: node.value, ...(display ? { dataActiveDisplay: 'true' } : {}) },
        hChildren: [{ type: 'text', value: substitute(node.value, results) }],
      };
    }
  };
}

/** A slider step that gives about 100 positions, rounded to 1, 2 or 5 × 10^k. */
function sliderStep(min: number, max: number): number {
  const raw = (max - min) / 100;
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return Number(((m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p).toPrecision(12));
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
