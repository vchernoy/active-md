import { DEFAULT_LIMITS } from './types.js';
export type ChoiceOption = { id: string; correct: boolean };
export type ChoiceMode = 'single' | 'multiple';
export type ChoiceAnswerCheck =
  | { kind: 'checked'; correct: boolean }
  | { kind: 'invalid'; field: 'choices' | 'given' | 'mode'; message: string };

/** Pure identity-based checking; shuffling presentation never changes the answer key. */
export function checkChoiceAnswer(choices: readonly ChoiceOption[], given: readonly string[], mode: ChoiceMode): ChoiceAnswerCheck {
  if (mode !== 'single' && mode !== 'multiple') return { kind: 'invalid', field: 'mode', message: 'choice mode must be single or multiple' };
  if (!Array.isArray(choices) || !choices.length || choices.length > DEFAULT_LIMITS.maxDefinitions) {
    return { kind: 'invalid', field: 'choices', message: 'choices must be a nonempty bounded array' };
  }
  const known = new Set<string>(), accepted = new Set<string>();
  let size = 0;
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object' || Array.isArray(choice) || typeof choice.id !== 'string' || !choice.id ||
        typeof choice.correct !== 'boolean') {
      return { kind: 'invalid', field: 'choices', message: 'choices require unique nonempty IDs and boolean correct flags' };
    }
    size += choice.id.length;
    if (size > DEFAULT_LIMITS.maxSourceLength) return { kind: 'invalid', field: 'choices', message: 'choice IDs exceed the length budget' };
    if (known.has(choice.id)) return { kind: 'invalid', field: 'choices', message: 'choice IDs must be unique' };
    known.add(choice.id); if (choice.correct) accepted.add(choice.id);
  }
  if (mode === 'single' && !accepted.size) return { kind: 'invalid', field: 'choices', message: 'single selection needs an accepted choice' };
  if (!Array.isArray(given) || given.length > DEFAULT_LIMITS.maxDefinitions || (mode === 'single' && given.length > 1)) {
    return { kind: 'invalid', field: 'given', message: 'submitted choices exceed the selection limit' };
  }
  const selected = new Set<string>(); size = 0;
  for (const id of given) {
    if (typeof id !== 'string') return { kind: 'invalid', field: 'given', message: 'submitted IDs must be strings' };
    size += id.length;
    if (size > DEFAULT_LIMITS.maxSourceLength) return { kind: 'invalid', field: 'given', message: 'submitted IDs exceed the length budget' };
    if (!known.has(id) || selected.has(id)) return { kind: 'invalid', field: 'given', message: 'submitted IDs must be known and unique' };
    selected.add(id);
  }
  const correct = mode === 'single' ? given.length === 1 && accepted.has(given[0]!)
    : selected.size === accepted.size && [...selected].every(id => accepted.has(id));
  return { kind: 'checked', correct };
}
