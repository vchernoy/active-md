import type { CompiledExpression, Session } from '@vchernoy/calc';
import type { QuizManifest, QuizSource } from '@vchernoy/remark-active';
import { inspectQuizManifest } from './quiz-manifest.js';

export type QuizCompilation = {
  kind: 'compiled';
  manifest: QuizManifest;
  /** Group IDs map to outer-to-inner conditions; no condition is evaluated here. */
  conditions: ReadonlyMap<string, readonly CompiledExpression[]>;
  /** Numeric question IDs only. Expressions remain bound to the supplied session. */
  answers: ReadonlyMap<string, CompiledExpression>;
} | {
  kind: 'invalid';
  reason: 'malformed' | 'version' | 'too-large' | 'program' | 'seed' | 'expression';
  groupId?: string;
  questionId?: string;
  source?: QuizSource;
  message?: string;
};

/** Prepare unknown metadata against a trusted calc Session, without evaluating or changing inputs. */
export function compileQuizManifest(value: unknown, session: Session): QuizCompilation {
  const checked = inspectQuizManifest(value);
  if (checked.kind === 'invalid') return checked;
  if (session.program.diagnostics.some(diagnostic => diagnostic.severity === 'error')) return { kind: 'invalid', reason: 'program' };
  const inputs = new Set(session.program.inputs.map(input => input.name));
  const cache = new Map<string, CompiledExpression>();
  const compile = (text: string): CompiledExpression => {
    let expression = cache.get(text);
    if (!expression) { expression = session.compile(text, 'quiz'); cache.set(text, expression); }
    return expression;
  };
  const conditions = new Map<string, CompiledExpression[]>();
  const answers = new Map<string, CompiledExpression>();
  for (const group of checked.manifest.groups) {
    if (group.seed !== undefined && !inputs.has(group.seed)) return { kind: 'invalid', reason: 'seed', groupId: group.id, source: group.source };
    const compiledConditions: CompiledExpression[] = [];
    for (const condition of group.conditions) {
      const expression = compile(condition.expression);
      const diagnostic = expression.diagnostics.find(diagnostic => diagnostic.severity === 'error');
      if (diagnostic) return { kind: 'invalid', reason: 'expression', groupId: group.id, source: condition.source, message: diagnostic.message };
      compiledConditions.push(expression);
    }
    conditions.set(group.id, compiledConditions);
    for (const question of group.questions) {
      if (question.type !== 'number') continue;
      const expression = compile(question.expected);
      const diagnostic = expression.diagnostics.find(diagnostic => diagnostic.severity === 'error');
      if (diagnostic) return { kind: 'invalid', reason: 'expression', groupId: group.id, questionId: question.id, source: question.source, message: diagnostic.message };
      answers.set(question.id, expression);
    }
  }
  return { kind: 'compiled', manifest: checked.manifest, conditions, answers };
}
