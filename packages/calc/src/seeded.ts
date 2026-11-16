/** Version 1 seeded draws: unsigned 32-bit counter mixing, no mutable PRNG state. */
const WORDS = 0x100000000;
const uint32 = (value: number) => Number.isInteger(value) && value >= 0 && value < WORDS;

export function seededDraw(seed: number, draw: number): number | string {
  if (!uint32(seed) || !uint32(draw)) return 'seed and draw must be integers from 0 to 4294967295';
  // MurmurHash3's fmix32 avalanche over a Weyl-offset counter. Math.imul and
  // unsigned shifts have the same specified 32-bit semantics in every engine.
  let word = (seed + Math.imul(draw, 0x9e3779b9)) >>> 0;
  word = Math.imul(word ^ (word >>> 16), 0x85ebca6b);
  word = Math.imul(word ^ (word >>> 13), 0xc2b2ae35);
  return ((word ^ (word >>> 16)) >>> 0) / WORDS;
}

export function seededInteger(seed: number, min: number, max: number, draw: number): number | string {
  const value = seededDraw(seed, draw);
  if (typeof value === 'string') return value;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    return 'bounds must be safe integers with min <= max';
  }
  const width = max - min + 1;
  if (width > WORDS) return 'range must contain at most 4294967296 integers';
  return min + Math.floor(value * width);
}
