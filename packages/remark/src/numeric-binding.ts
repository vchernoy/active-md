import { parseFormat, type Format } from '@vchernoy/calc';

export type NumericBinding = { expression: string; format?: Format; problem?: string };

/** A single optional format separator; pipes are not calc operators. */
export function numericBinding(source: string): NumericBinding {
  const parts = source.split('|');
  const expression = parts[0]!.trim();
  if (parts.length === 1) return { expression };
  if (parts.length !== 2) return { expression, problem: 'use one | format separator' };
  const spec = parts[1]!.trim();
  if (!expression || !spec) return { expression, problem: 'expected expression | format' };
  const format = parseFormat(spec);
  return typeof format === 'string' ? { expression, problem: format } : { expression, format };
}
