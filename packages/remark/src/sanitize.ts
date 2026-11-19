import { defaultSchema } from 'rehype-sanitize';
import type { Options as Schema } from 'rehype-sanitize';

const ACTIVE = ['dataActiveWhenConstant', 'dataActiveWhen', 'dataActiveWhenId', 'dataActiveWhenDisabled', 'dataActiveWhenError', 'dataActiveInput', 'dataActiveValue', 'dataActiveFormat', 'dataActiveTex', 'dataActiveDisplay', 'dataActiveCalc', 'dataActiveFor', 'dataActiveWidget', 'dataActiveError'];

/**
 * GitHub's sanitize schema plus the elements and attributes active-md emits.
 * KaTeX output is added after sanitizing, so MathML isn't listed here.
 */
export const activeSchema: Schema = {
  ...defaultSchema,
  // <picture>/<source> would fetch images on display; images become links instead (rehypeActiveImages).
  tagNames: [...(defaultSchema.tagNames ?? []).filter(t => t !== 'picture' && t !== 'source'), 'input', 'output', 'aside', 'label', 'select', 'option'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), ...ACTIVE, 'hidden', 'className', 'role', 'ariaLive', 'ariaLabel', 'title'],
    // Image links (rehypeActiveImages); GitHub's schema otherwise allows only footnote classes on <a>.
    a: [
      ...(defaultSchema.attributes?.['a'] ?? []).filter(a => !(Array.isArray(a) && a[0] === 'className')),
      ['className', 'data-footnote-backref', 'active-image'],
      'rel',
    ],
    // Task-list checkboxes keep GitHub's rule (disabled checkbox) through remark-gfm; our inputs are number/range.
    select: [],
    option: ['value', 'selected'],
    input: [['disabled', true], ['type', 'checkbox', 'number', 'range'], 'checked', 'value', 'min', 'max', 'step', 'inputMode'],
  },
  // GitHub's schema forces every <input> to be a disabled checkbox; ours are live number boxes and sliders.
  required: Object.fromEntries(Object.entries(defaultSchema.required ?? {}).filter(([tag]) => tag !== 'input')),
};
