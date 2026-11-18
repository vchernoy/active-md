import { DEFAULT_LIMITS } from './types.js';
export type QuizScoreInput = { correct: boolean; points?: number };
export type ScoredQuestion = { correct: boolean; points: number; earned: number };
export type QuizGroupScore = { kind: 'scored'; earned: number; max: number; results: ScoredQuestion[] }
  | { kind: 'invalid'; field: 'results' | 'correct' | 'points' | 'total'; index?: number; message: string };

/** Sum already-checked questions in source order; raw responses and attempt state belong to the caller. */
export function scoreQuizGroup(results: readonly QuizScoreInput[]): QuizGroupScore {
  if (!Array.isArray(results) || !results.length || results.length > DEFAULT_LIMITS.maxDefinitions) {
    return { kind: 'invalid', field: 'results', message: 'a quiz group requires a nonempty bounded result array' };
  }
  let earned = 0, max = 0;
  const scored: ScoredQuestion[] = [];
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.correct !== 'boolean') {
      return { kind: 'invalid', field: 'correct', index, message: 'question correctness must be a boolean' };
    }
    const points = result.points === undefined ? 1 : result.points;
    if (typeof points !== 'number' || !Number.isFinite(points) || points < 0) {
      return { kind: 'invalid', field: 'points', index, message: 'question points must be finite and nonnegative' };
    }
    const value = result.correct ? points : 0;
    earned += value; max += points;
    if (!Number.isFinite(earned) || !Number.isFinite(max)) return { kind: 'invalid', field: 'total', index, message: 'quiz point totals must remain finite' };
    scored.push({ correct: result.correct, points, earned: value });
  }
  return { kind: 'scored', earned, max, results: scored };
}
