import { simplifyExpression, simplifyProgram } from './simplify.js';
import { builtin, constant, RESERVED } from './builtins.js';
import { tokenize, type Token } from './lexer.js';
import { DEFAULT_LIMITS, type Definition, type Diagnostic, type Expr, type Limits, type NameInfo, type Program, type Span } from './types.js';

type Raw =
  | { kind: 'input'; name: string; nameSpan: Span; default: number; range?: { min: number; max: number }; span: Span }
  | { kind: 'value'; name: string; nameSpan: Span; expr: Expr; span: Span }
  /** A statement that failed to parse but clearly defines `name`; the name exists, as an error. */
  | { kind: 'broken'; name: string; nameSpan: Span; error: Diagnostic };

class ParseError extends Error { constructor(message: string, readonly span: Span) { super(message); } }

const BIN_PREC: Record<string, number> = { or: 1, and: 2, '==': 4, '!=': 4, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 8 };
const comparisons = new Set(['==', '!=', '<', '<=', '>', '>=']);

/** Pratt parser over one statement's tokens. */
class ExprParser {
  private p = 0;
  /** Height of every node built so far. Left-associative chains grow the tree without recursing, so recursion depth alone doesn't bound it. */
  private heights = new WeakMap<Expr, number>();
  constructor(private tokens: Token[], private maxDepth: number) {}
  peek(): Token { return this.tokens[this.p]!; }
  next(): Token { return this.tokens[this.p++]!; }
  /** Record a new node's height and reject trees deeper than the limit, so later recursive walks stay bounded. */
  private node<E extends Expr>(e: E, ...children: Expr[]): E {
    const h = 1 + Math.max(0, ...children.map(c => this.heights.get(c) ?? 1));
    if (h > this.maxDepth) throw new ParseError('expression is nested too deeply', e.span);
    this.heights.set(e, h);
    return e;
  }
  atEnd(): boolean { const t = this.peek(); return t.t === 'nl' || t.t === 'eof'; }
  expectOp(value: string): Token {
    const t = this.next();
    if (t.t !== 'op' || t.value !== value) throw new ParseError(`expected "${value}"`, t.span);
    return t;
  }
  expr(minPrec = 0, depth = 0): Expr {
    if (depth > this.maxDepth) throw new ParseError('expression is nested too deeply', this.peek().span);
    let left = this.unary(depth);
    let compared = false;
    for (;;) {
      const t = this.peek();
      if ((t.t !== 'op' && t.t !== 'name') || !Object.hasOwn(BIN_PREC, t.value)) break;
      const prec = BIN_PREC[t.value]!;
      if (prec < minPrec) break;
      if (comparisons.has(t.value) && compared)
        throw new ParseError('comparisons cannot be chained; use and', t.span);
      this.next();
      if (comparisons.has(t.value)) compared = true;
      // ^ is right-associative; the others are left-associative.
      const right = this.expr(t.value === '^' ? prec : prec + 1, depth + 1);
      left = this.node({ kind: 'bin', op: t.value as '+', left, right, span: join(left.span, right.span) }, left, right);
    }
    return left;
  }
  private unary(depth: number): Expr {
    const t = this.peek();
    if (t.t === 'name' && t.value === 'not') {
      this.next();
      const arg = this.expr(3, depth + 1);
      return this.node({ kind: 'not', arg, span: join(t.span, arg.span) }, arg);
    }
    // Unary minus binds looser than ^: -2^2 is -(2^2).
    if (t.t === 'op' && t.value === '-') {
      this.next();
      const arg = this.expr(7, depth + 1);
      return this.node({ kind: 'neg', arg, span: join(t.span, arg.span) }, arg);
    }
    if (t.t === 'op' && t.value === '+') { this.next(); return this.expr(7, depth + 1); }
    return this.primary(depth);
  }
  private primary(depth: number): Expr {
    const t = this.next();
    if (t.t === 'num') return { kind: 'num', value: t.value, span: t.span };
    if (t.t === 'bad') throw new ParseError(t.message, t.span);
    if (t.t === 'op' && t.value === '(') {
      const inner = this.expr(0, depth + 1);
      this.expectOp(')');
      return inner;
    }
    if (t.t === 'name') {
      const after = this.peek();
      if (after.t === 'op' && after.value === '(') {
        this.next();
        const args: Expr[] = [];
        if (!(this.peek().t === 'op' && (this.peek() as { value: string }).value === ')')) {
          for (;;) {
            args.push(this.expr(0, depth + 1));
            const sep = this.peek();
            if (sep.t === 'op' && sep.value === ',') { this.next(); continue; }
            break;
          }
        }
        const close = this.expectOp(')');
        if (t.value === 'if') {
          if (args.length < 3 || args.length % 2 !== 1) throw new ParseError('if needs an odd number of arguments, at least 3 (including otherwise)', join(t.span, close.span));
          return this.node({ kind: 'if', args, span: join(t.span, close.span) }, ...args);
        }
        if (RESERVED.has(t.value)) throw new ParseError(`"${t.value}" is a reserved word`, t.span);
        return this.node({ kind: 'call', fn: t.value, args, span: join(t.span, close.span) }, ...args);
      }
      if (RESERVED.has(t.value)) throw new ParseError(`"${t.value}" is a reserved word`, t.span);
      return { kind: 'ref', name: t.value, span: t.span };
    }
    if (t.t === 'nl' || t.t === 'eof') throw new ParseError('the expression is incomplete', t.span);
    throw new ParseError(`unexpected "${t.value}"`, t.span);
  }
}

function join(a: Span, b: Span): Span { return { ...a, end: b.end }; }

function signedNumber(p: ExprParser): number {
  const t = p.next();
  if (t.t === 'op' && t.value === '-') { const n = p.next(); if (n.t === 'num') return -n.value; throw new ParseError('expected a number', n.span); }
  if (t.t === 'num') return t.value;
  throw new ParseError('expected a number (inputs take a number as their default in v0)', t.span);
}

/** Split tokens into statements (one per line) and parse each. Errors are per statement. */
function parseStatements(block: string, text: string, limits: Limits, diagnostics: Diagnostic[]): Raw[] {
  const tokens = tokenize(block, text);
  const out: Raw[] = [];
  let i = 0;
  while (i < tokens.length && tokens[i]!.t !== 'eof') {
    let j = i;
    while (tokens[j]!.t !== 'nl' && tokens[j]!.t !== 'eof') j++;
    const stmt = [...tokens.slice(i, j), { t: 'eof' as const, span: tokens[j]!.span }];
    i = tokens[j]!.t === 'nl' ? j + 1 : j;
    if (stmt.length === 1) continue;
    try {
      out.push(parseStatement(stmt, limits));
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      const error: Diagnostic = { severity: 'error', message: e.message, span: e.span };
      const named = definedName(stmt);
      if (named) out.push({ kind: 'broken', name: named.value, nameSpan: named.span, error });
      else diagnostics.push(error);
    }
  }
  return out;
}

/** The name a statement defines, if its start is well-formed ("name =" or "input name"), and the name is allowed. */
function definedName(tokens: Token[]): { value: string; span: Span } | undefined {
  const [a, b] = tokens;
  const name = a?.t === 'name' && a.value === 'input' ? (b?.t === 'name' ? b : undefined)
    : a?.t === 'name' && b?.t === 'op' && b.value === '=' ? a : undefined;
  if (!name || RESERVED.has(name.value) || builtin(name.value)) return undefined;
  return { value: name.value, span: name.span };
}

function parseStatement(tokens: Token[], limits: Limits): Raw {
  const p = new ExprParser(tokens, limits.maxDepth);
  const first = p.next();
  const start = first.span;
  if (first.t === 'name' && first.value === 'input') {
    const name = p.next();
    if (name.t !== 'name') throw new ParseError('expected the input\'s name', name.span);
    checkName(name.value, name.span);
    p.expectOp('=');
    const def = signedNumber(p);
    let range: { min: number; max: number } | undefined;
    const t = p.peek();
    if (t.t === 'name' && t.value === 'in') {
      p.next();
      const min = signedNumber(p);
      p.expectOp('..');
      const max = signedNumber(p);
      if (min > max) throw new ParseError(`the range ${min}..${max} is empty`, t.span);
      range = { min, max };
    }
    if (!p.atEnd()) throw new ParseError(`unexpected "${(p.peek() as { value?: string }).value ?? ''}" after the input definition`, p.peek().span);
    if (range && (def < range.min || def > range.max)) throw new ParseError(`the default ${def} is outside ${range.min}..${range.max}`, name.span);
    const end = tokens[tokens.length - 2]!.span;
    return range
      ? { kind: 'input', name: name.value, nameSpan: name.span, default: def, range, span: join(start, end) }
      : { kind: 'input', name: name.value, nameSpan: name.span, default: def, span: join(start, end) };
  }
  if (first.t !== 'name') throw new ParseError('a line must start with a name, or with "input"', first.span);
  checkName(first.value, first.span);
  const eq = p.peek();
  if (eq.t === 'op' && eq.value === '(') throw new ParseError('functions are not supported yet (v0 has values and inputs only)', eq.span);
  p.expectOp('=');
  const expr = p.expr();
  if (!p.atEnd()) {
    const t = p.peek();
    throw new ParseError(`unexpected "${t.t === 'op' || t.t === 'name' ? t.value : t.t === 'num' ? String(t.value) : ''}" after the expression`, t.span);
  }
  return { kind: 'value', name: first.value, nameSpan: first.span, expr, span: join(start, expr.span) };
}

function checkName(name: string, span: Span): void {
  if (RESERVED.has(name)) throw new ParseError(`"${name}" is a reserved word`, span);
  if (builtin(name)) throw new ParseError(`"${name}" is a built-in function and can't be redefined`, span);
}

/** Names an expression refers to; also checks calls against the built-ins. */
export function collectRefs(expr: Expr, refs: Map<string, Span>, problems: Diagnostic[]): void {
  switch (expr.kind) {
    case 'num': return;
    case 'ref': if (!refs.has(expr.name)) refs.set(expr.name, expr.span); return;
    case 'not':
    case 'neg': collectRefs(expr.arg, refs, problems); return;
    case 'if': for (const arg of expr.args) collectRefs(arg, refs, problems); return;
    case 'bin': collectRefs(expr.left, refs, problems); collectRefs(expr.right, refs, problems); return;
    case 'call': {
      const b = builtin(expr.fn);
      if (!b) problems.push({ severity: 'error', message: `unknown function "${expr.fn}"`, span: expr.span });
      else if (expr.args.length < b.min || expr.args.length > b.max) {
        const want = b.min === b.max ? `${b.min}` : b.max === Infinity ? `at least ${b.min}` : `${b.min} or ${b.max}`;
        problems.push({ severity: 'error', message: `${expr.fn} takes ${want} argument${b.max === 1 ? '' : 's'}, got ${expr.args.length}`, span: expr.span });
      }
      for (const a of expr.args) collectRefs(a, refs, problems);
    }
  }
}

/**
 * Parse calc blocks, in document order, into one program.
 * Rules: each name is defined once; an expression may use only names defined above it.
 */
export function parse(blocks: readonly { id: string; text: string }[], limits: Limits = DEFAULT_LIMITS): Program {
  const diagnostics: Diagnostic[] = [];
  const total = blocks.reduce((n, b) => n + b.text.length, 0);
  const emptySpan: Span = { block: blocks[0]?.id ?? '', start: 0, end: 0, line: 1, column: 1 };
  if (total > limits.maxSourceLength) {
    diagnostics.push({ severity: 'error', message: `calc source is too long (${total} characters, limit ${limits.maxSourceLength})`, span: emptySpan });
    return { definitions: [], inputs: [], names: new Map(), broken: new Map(), diagnostics };
  }
  const raws = blocks.flatMap(b => parseStatements(b.id, b.text, limits, diagnostics));
  if (raws.length > limits.maxDefinitions) {
    diagnostics.push({ severity: 'error', message: `too many definitions (${raws.length}, limit ${limits.maxDefinitions})`, span: emptySpan });
    return { definitions: [], inputs: [], names: new Map(), broken: new Map(), diagnostics };
  }
  // Where each name is first defined, so "used before it is defined" can say where.
  const firstAt = new Map<string, Span>();
  for (const r of raws) if (!firstAt.has(r.name)) firstAt.set(r.name, r.nameSpan);

  const names = new Map<string, NameInfo>();
  const broken = new Map<string, Diagnostic>();
  const definitions: Definition[] = [];
  for (const r of raws) {
    const prior = names.get(r.name);
    if (prior) {
      diagnostics.push({ severity: 'error', name: r.name, message: `"${r.name}" is already defined on line ${prior.span.line}; each name is defined once`, span: r.nameSpan });
      if (r.kind === 'broken') diagnostics.push({ ...r.error, name: r.name });
      continue;
    }
    if (constant(r.name) !== undefined) diagnostics.push({ severity: 'warning', name: r.name, message: `"${r.name}" shadows the built-in constant`, span: r.nameSpan });
    if (r.kind === 'broken') {
      diagnostics.push({ ...r.error, name: r.name });
      names.set(r.name, { kind: 'value', span: r.nameSpan, index: -1 });
      broken.set(r.name, { ...r.error, name: r.name });
      continue;
    }
    if (r.kind === 'input') {
      names.set(r.name, { kind: 'input', span: r.nameSpan, index: definitions.length });
      definitions.push(r.range
        ? { kind: 'input', name: r.name, default: r.default, range: r.range, span: r.span, deps: new Set() }
        : { kind: 'input', name: r.name, default: r.default, span: r.span, deps: new Set() });
      continue;
    }
    const refs = new Map<string, Span>();
    const problems: Diagnostic[] = [];
    collectRefs(r.expr, refs, problems);
    for (const [ref, span] of refs) {
      if (names.has(ref)) continue;
      if (!firstAt.has(ref) && constant(ref) !== undefined) { refs.delete(ref); continue; }
      const later = firstAt.get(ref);
      problems.push({
        severity: 'error', name: r.name, span,
        message: ref === r.name ? `"${ref}" can't refer to itself`
          : later ? `"${ref}" is used before it is defined (line ${later.line}${later.block !== span.block ? ` of block ${later.block}` : ''})`
          : `unknown name "${ref}"`,
      });
    }
    if (problems.length) {
      names.set(r.name, { kind: 'value', span: r.nameSpan, index: -1 });
      for (const d of problems) diagnostics.push({ ...d, name: r.name });
      broken.set(r.name, { ...problems[0]!, name: r.name });
      continue;
    }
    names.set(r.name, { kind: 'value', span: r.nameSpan, index: definitions.length });
    definitions.push({ kind: 'value', name: r.name, expr: r.expr, span: r.span, deps: new Set(refs.keys()) });
  }
  return simplifyProgram({ definitions, inputs: definitions.filter((d): d is Extract<Definition, { kind: 'input' }> => d.kind === 'input'), names, broken, diagnostics });
}

/** Parse a single expression (for bindings such as :value[expr] or {{expr}}) against a program's names. */
export function parseExpression(program: Program, text: string, id = 'expression', limits: Limits = DEFAULT_LIMITS):
  { expr?: Expr; deps: ReadonlySet<string>; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const tokens = tokenize(id, text).filter(t => t.t !== 'nl');
  const p = new ExprParser(tokens, limits.maxDepth);
  let expr: Expr;
  try {
    expr = p.expr();
    if (!p.atEnd()) throw new ParseError('unexpected text after the expression', p.peek().span);
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    return { deps: new Set(), diagnostics: [{ severity: 'error', message: e.message, span: e.span }] };
  }
  const refs = new Map<string, Span>();
  collectRefs(expr, refs, diagnostics);
  for (const [ref] of refs) if (!program.names.has(ref) && constant(ref) !== undefined) refs.delete(ref);
  for (const [ref, span] of refs) if (!program.names.has(ref)) diagnostics.push({ severity: 'error', message: `unknown name "${ref}"`, span });
  if (diagnostics.length) return { deps: new Set(refs.keys()), diagnostics };
  const prepared = simplifyExpression(program, expr);
  return { expr: prepared.expr, deps: prepared.deps, diagnostics };
}
