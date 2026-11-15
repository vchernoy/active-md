/** A position in one calc block (or in a binding expression). Offsets are UTF-16 indices. */
export type Span = { block: string; start: number; end: number; line: number; column: number };

type Preparation = { steps?: number; source?: Expr; sourceCost?: number; guards?: readonly string[] };

export type Expr = Preparation & (
  | { kind: 'num'; value: number; span: Span }
  | { kind: 'ref'; name: string; span: Span }
  | { kind: 'neg'; arg: Expr; span: Span }
  | { kind: 'not'; arg: Expr; span: Span }
  | { kind: 'if'; args: Expr[]; span: Span }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/' | '%' | '^' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'and' | 'or'; left: Expr; right: Expr; span: Span }
  | { kind: 'call'; fn: string; args: Expr[]; span: Span }
);

export type Range = { min: number; max: number };

export type Definition =
  | { kind: 'input'; name: string; default: number; range?: Range; span: Span; deps: ReadonlySet<string> }
  | { kind: 'value'; name: string; expr: Expr; span: Span; deps: ReadonlySet<string> };

export type Severity = 'error' | 'warning';
export type Diagnostic = { severity: Severity; message: string; span: Span; name?: string };

/** `index` is the position in `definitions`, or -1 for a broken definition. */
export type NameInfo = { kind: 'input' | 'value'; span: Span; index: number };

export type Program = {
  /** Original dependency graph, retained for restrictive host evaluation budgets. */
  source?: Program;
  /** Valid definitions, in document order (which is also a valid evaluation order). */
  definitions: readonly Definition[];
  inputs: readonly Extract<Definition, { kind: 'input' }>[];
  names: ReadonlyMap<string, NameInfo>;
  /** Names whose definition has an error; their value is that error. */
  broken: ReadonlyMap<string, Diagnostic>;
  diagnostics: readonly Diagnostic[];
};

/** Every name evaluates to a value or an error. (`missing` arrives after v0.) */
export type Result =
  | { kind: 'value'; value: number }
  | { kind: 'error'; message: string; span?: Span };

export type Limits = {
  maxSourceLength: number;
  maxDefinitions: number;
  maxSteps: number;
  maxDepth: number;
};

export const DEFAULT_LIMITS: Limits = {
  maxSourceLength: 64 * 1024,
  maxDefinitions: 2000,
  maxSteps: 1_000_000,
  maxDepth: 200,
};
