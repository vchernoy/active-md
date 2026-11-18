import { seededInteger } from './seeded.js';
import { DEFAULT_LIMITS } from './types.js';
export type ChoiceOrderResult = { kind: 'shuffled'; ids: string[] }
  | { kind: 'invalid'; field: 'ids' | 'seed' | 'draw'; message: string };
/** Version 1: descending Fisher–Yates using consecutive v1 seeded draws; no mutable random state. */
export function shuffleChoiceIds(ids: readonly string[], seed: number, draw = 0): ChoiceOrderResult {
  if (!Array.isArray(ids) || ids.length > DEFAULT_LIMITS.maxDefinitions) return { kind: 'invalid', field: 'ids', message: 'choice IDs must be a bounded array' };
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return { kind: 'invalid', field: 'seed', message: 'seed must be an unsigned 32-bit integer' };
  if (!Number.isInteger(draw) || draw < 0 || draw > 0xffffffff || draw + Math.max(0, ids.length - 2) > 0xffffffff) {
    return { kind: 'invalid', field: 'draw', message: 'draw sequence must fit unsigned 32-bit integers' };
  }
  const seen = new Set<string>(); let size = 0;
  for (const id of ids) {
    if (typeof id !== 'string' || !id) return { kind: 'invalid', field: 'ids', message: 'choice IDs must be nonempty strings' };
    size += id.length;
    if (size > DEFAULT_LIMITS.maxSourceLength) return { kind: 'invalid', field: 'ids', message: 'choice IDs exceed the length budget' };
    if (seen.has(id)) return { kind: 'invalid', field: 'ids', message: 'choice IDs must be unique' };
    seen.add(id);
  }
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = seededInteger(seed, 0, i, draw + result.length - 1 - i);
    // All arguments were validated above; preserve the seeded helper's error boundary.
    if (typeof j === 'string') return { kind: 'invalid', field: 'draw', message: j };
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return { kind: 'shuffled', ids: result };
}
