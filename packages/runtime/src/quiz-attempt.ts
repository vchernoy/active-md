import type { QuizGroup } from '@vchernoy/remark-active';
import type { QuizGroupCheck, QuizResponses } from './quiz-check.js';

/** Accepted response, not raw input text or an expected answer. Null means unanswered. */
export type CompletedQuizResponse = Readonly<{ questionId: string } & (
  { type: 'number'; value: number | null } |
  { type: 'single' | 'multiple'; value: readonly string[] }
)>;

/** Point-in-time self-check output. Versions/identities do not prove source compatibility. */
export type CompletedQuizAttempt = Readonly<{
  version: 1;
  manifestVersion: 1;
  groupId: string;
  seed: Readonly<{ input: string; value: number }> | null;
  responses: readonly CompletedQuizResponse[];
  earned: number;
  max: number;
  results: readonly Readonly<{ questionId: string; correct: boolean; points: number; earned: number }>[];
}>;

/** Detached, deeply frozen data only: never retain controls, manifest entries or the response map. */
export function completedQuizAttempt(group: QuizGroup, manifestVersion: 1, responses: QuizResponses,
  result: Extract<QuizGroupCheck, { kind: 'checked' }>, seedValue: number | undefined): CompletedQuizAttempt {
  const accepted = group.questions.map((question): CompletedQuizResponse => {
    const given = responses.get(question.id);
    return question.type === 'number'
      ? Object.freeze({ questionId: question.id, type: question.type, value: given === undefined ? null : given as number })
      : Object.freeze({ questionId: question.id, type: question.type, value: Object.freeze([...(given as readonly string[] | undefined ?? [])]) });
  });
  return Object.freeze({
    version: 1, manifestVersion, groupId: group.id,
    seed: group.seed === undefined ? null : Object.freeze({ input: group.seed, value: seedValue! }),
    responses: Object.freeze(accepted), earned: result.earned, max: result.max,
    results: Object.freeze(result.results.map(row => Object.freeze({ ...row }))),
  });
}
