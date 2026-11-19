import { checkAnswer, checkChoiceAnswer, DEFAULT_LIMITS, scoreQuizGroup } from '@vchernoy/calc';
import type { QuizCompilation } from './quiz-compile.js';
export type QuizResponses = ReadonlyMap<string, number | readonly string[]>;
export type QuizGroupCheck = { kind: 'hidden'; groupId: string }
  | { kind: 'checked'; groupId: string; earned: number; max: number;
      results: { questionId: string; correct: boolean; points: number; earned: number }[] }
  | { kind: 'invalid'; reason: 'group' | 'configuration' | 'condition' | 'answer' | 'response' | 'score'; groupId: string; questionId?: string };

/** Point-in-time self-check for trusted prepared data and a host-owned, parsed response map. */
export function checkQuizGroup(prepared: Extract<QuizCompilation, { kind: 'compiled' }>, groupId: string, responses: QuizResponses): QuizGroupCheck {
  const invalid = (reason: Extract<QuizGroupCheck, { kind: 'invalid' }>['reason'], questionId?: string): QuizGroupCheck =>
    ({ kind: 'invalid', reason, groupId, ...(questionId === undefined ? {} : { questionId }) });
  const group = prepared.manifest.groups.find(group => group.id === groupId);
  if (!group) return invalid('group');
  const conditions = prepared.conditions.get(groupId);
  if (!conditions || conditions.length !== group.conditions.length) return invalid('configuration');
  for (const condition of conditions) {
    const result = condition.evaluate();
    if (result.kind !== 'value' || !Number.isFinite(result.value)) return invalid('condition');
    if (result.value === 0) return { kind: 'hidden', groupId };
  }
  const known = new Set(group.questions.map(question => question.id));
  if (responses.size > known.size) return invalid('response');
  for (const key of responses.keys()) {
    if (typeof key !== 'string' || key.length > DEFAULT_LIMITS.maxSourceLength || !known.has(key)) return invalid('response');
  }
  const results: { correct: boolean; points: number }[] = [];
  for (const question of group.questions) {
    const given = responses.get(question.id);
    let correct: boolean;
    if (question.type === 'number') {
      const expression = prepared.answers.get(question.id);
      if (!expression) return invalid('configuration', question.id);
      const expected = expression.evaluate();
      if (expected.kind !== 'value' || !Number.isFinite(expected.value)) return invalid('answer', question.id);
      if (given === undefined) correct = false;
      else {
        if (typeof given !== 'number') return invalid('response', question.id);
        const checked = checkAnswer(expected.value, given, { tolerance: question.tolerance, relative: question.relative });
        if (checked.kind === 'invalid') return invalid(checked.field === 'given' ? 'response' : 'configuration', question.id);
        correct = checked.correct;
      }
    } else {
      if (given !== undefined && !Array.isArray(given)) return invalid('response', question.id);
      const checked = checkChoiceAnswer(question.choices, given === undefined ? [] : given as readonly string[], question.type);
      if (checked.kind === 'invalid') return invalid(checked.field === 'given' ? 'response' : 'configuration', question.id);
      correct = checked.correct;
    }
    results.push({ correct, points: question.points });
  }
  const score = scoreQuizGroup(results);
  if (score.kind === 'invalid') return invalid('score');
  return { kind: 'checked', groupId, earned: score.earned, max: score.max,
    results: score.results.map((result, index) => ({ questionId: group.questions[index]!.id, ...result })) };
}
