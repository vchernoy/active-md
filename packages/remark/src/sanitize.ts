import { defaultSchema } from 'rehype-sanitize';
import type { Options as Schema } from 'rehype-sanitize';

const ACTIVE = ['dataActiveInput', 'dataActiveValue', 'dataActiveFormat', 'dataActiveTex', 'dataActiveDisplay', 'dataActiveCalc', 'dataActiveFor', 'dataActiveWidget', 'dataActiveError'];

/**
 * GitHub's sanitize schema plus the elements and attributes active-md emits.
 * KaTeX output is added after sanitizing, so MathML isn't listed here.
 */
export const activeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'input', 'output', 'aside', 'label'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), ...ACTIVE, 'className', 'role', 'ariaLive', 'ariaLabel', 'title'],
    // Task-list checkboxes keep GitHub's rule (disabled checkbox) through remark-gfm; our inputs are number/range.
    input: [['disabled', true], ['type', 'checkbox', 'number', 'range'], 'checked', 'value', 'min', 'max', 'step', 'inputMode'],
  },
  // GitHub's schema forces every <input> to be a disabled checkbox; ours are live number boxes and sliders.
  required: Object.fromEntries(Object.entries(defaultSchema.required ?? {}).filter(([tag]) => tag !== 'input')),
};
