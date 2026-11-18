import { DEFAULT_LIMITS, scoreQuizGroup } from '@vchernoy/calc';
import type { QuizManifest, QuizGroup, QuizQuestion, QuizChoice, QuizCondition, QuizSource } from '@vchernoy/remark-active';
export type QuizManifestInspection = { kind: 'valid'; manifest: QuizManifest }
  | { kind: 'invalid'; reason: 'malformed' | 'version' | 'too-large' };
type Reason = 'malformed' | 'version' | 'too-large';
class ManifestFailure extends Error { constructor(readonly reason: Reason) { super(reason); } }

/** Schema trust boundary only: does not prove compatibility with a source, session or DOM. */
export function inspectQuizManifest(value: unknown): QuizManifestInspection {
  const fail = (reason: Reason): never => { throw new ManifestFailure(reason); };
  const object = (raw: unknown): Record<string, unknown> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('malformed');
    return raw as Record<string, unknown>;
  };
  const list = (raw: unknown, max = DEFAULT_LIMITS.maxDefinitions) => {
    if (!Array.isArray(raw)) return fail('malformed');
    const length: unknown = raw.length;
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return fail('malformed');
    if (length > max) return fail('too-large');
    return { length, map<T>(visit: (value: unknown) => T): T[] {
      const copied: T[] = [];
      for (let index = 0; index < length; index++) {
        if (!Object.hasOwn(raw, index)) return fail('malformed');
        copied.push(visit(raw[index]));
      }
      return copied;
    } };
  };
  let chars = 0, questionCount = 0, choiceCount = 0;
  const text = (raw: unknown, nonempty = true): string => {
    if (typeof raw !== 'string') return fail('malformed');
    chars += raw.length;
    if (chars > DEFAULT_LIMITS.maxSourceLength) return fail('too-large');
    if (nonempty && !raw.trim()) return fail('malformed');
    return raw;
  };
  const identity = (raw: unknown, seen: Set<string>): string => {
    const id = text(raw);
    if (seen.has(id)) return fail('malformed');
    seen.add(id); return id;
  };
  const position = (raw: unknown): QuizSource => {
    const source = object(raw); const { line, column } = source;
    if (typeof line !== 'number' || !Number.isSafeInteger(line) || line < 1 ||
        typeof column !== 'number' || !Number.isSafeInteger(column) || column < 1) return fail('malformed');
    return { line, column };
  };
  const nonnegative = (raw: unknown): number => {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return fail('malformed');
    return raw;
  };
  const boolean = (raw: unknown): boolean => typeof raw === 'boolean' ? raw : fail('malformed');
  try {
    const root = object(value);
    if (typeof root.version !== 'number' || !Number.isSafeInteger(root.version) || root.version < 1) return fail('malformed');
    if (root.version !== 1) return fail('version');
    const groupIds = new Set<string>(), questionIds = new Set<string>(), seeds = new Set<string>();
    const groups = list(root.groups).map((raw): QuizGroup => {
      const group = object(raw); const id = identity(group.id, groupIds); const source = position(group.source);
      const conditions = list(group.conditions, 8).map((raw): QuizCondition => {
        const condition = object(raw); return { expression: text(condition.expression), source: position(condition.source) };
      });
      const seed = group.seed === undefined ? undefined : identity(group.seed, seeds);
      const rows = list(group.questions);
      if (!rows.length) return fail('malformed');
      questionCount += rows.length;
      if (questionCount > DEFAULT_LIMITS.maxDefinitions) return fail('too-large');
      const questions = rows.map((raw): QuizQuestion => {
        const question = object(raw);
        const base = { id: identity(question.id, questionIds), source: position(question.source), points: nonnegative(question.points) };
        const type = question.type;
        if (type === 'number') return { ...base, type: 'number', expected: text(question.expected), tolerance: nonnegative(question.tolerance), relative: boolean(question.relative) };
        if (type !== 'single' && type !== 'multiple') return fail('malformed');
        const entries = list(question.choices);
        if (!entries.length) return fail('malformed');
        choiceCount += entries.length;
        if (choiceCount > DEFAULT_LIMITS.maxDefinitions) return fail('too-large');
        const ids = new Set<string>();
        const choices = entries.map((raw): QuizChoice => {
          const choice = object(raw);
          return { id: identity(choice.id, ids), labelSource: text(choice.labelSource, false), correct: boolean(choice.correct), source: position(choice.source) };
        });
        if (type === 'single' && !choices.some(choice => choice.correct)) return fail('malformed');
        return { ...base, type, choices };
      });
      if (scoreQuizGroup(questions.map(question => ({ correct: false, points: question.points }))).kind === 'invalid') return fail('malformed');
      return { id, source, conditions, ...(seed === undefined ? {} : { seed }), questions };
    });
    const manifest: QuizManifest = { version: 1, groups };
    if (JSON.stringify(manifest).length > DEFAULT_LIMITS.maxSourceLength) return fail('too-large');
    return { kind: 'valid', manifest };
  } catch (error) { return { kind: 'invalid', reason: error instanceof ManifestFailure ? error.reason : 'malformed' }; }
}
