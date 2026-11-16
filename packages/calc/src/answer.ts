export type NumericAnswerOptions = { tolerance?: number; relative?: boolean };
export type NumericAnswerCheck =
  | { kind: 'checked'; correct: boolean }
  | { kind: 'invalid'; field: 'expected' | 'given' | 'tolerance' | 'relative'; message: string };

/** Pure numeric self-check; callers evaluate expected expressions and parse responses separately. */
export function checkAnswer(expected: number, given: number, options: NumericAnswerOptions = {}): NumericAnswerCheck {
  if (!Number.isFinite(expected)) return { kind: 'invalid', field: 'expected', message: 'expected answer must be a finite number' };
  if (!Number.isFinite(given)) return { kind: 'invalid', field: 'given', message: 'response must be a finite number' };
  const tolerance = options.tolerance === undefined ? 0 : options.tolerance;
  if (!Number.isFinite(tolerance) || tolerance < 0) return { kind: 'invalid', field: 'tolerance', message: 'tolerance must be a finite nonnegative number' };
  if (options.relative !== undefined && typeof options.relative !== 'boolean') {
    return { kind: 'invalid', field: 'relative', message: 'relative must be a boolean' };
  }
  if (expected === given) return { kind: 'checked', correct: true };
  if (tolerance === 0) return { kind: 'checked', correct: false };
  const difference = Math.abs(given - expected);
  if (!options.relative) return { kind: 'checked', correct: difference <= tolerance };
  // Relative tolerance scales against |expected|. A zero expected answer only
  // accepts zero. Divide instead of multiplying a bound that could overflow;
  // if subtraction overflows, normalize the operands before subtracting.
  const error = expected === 0 ? Infinity : Number.isFinite(difference)
    ? difference / Math.abs(expected)
    : Math.abs(given / expected - 1);
  return { kind: 'checked', correct: error <= tolerance };
}
