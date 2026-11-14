import type { Program } from '@vchernoy/calc';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { remarkActive, type ActiveOptions } from './plugin.js';
import { rehypeActiveKatex, rehypeActiveWrap, type KatexOptions } from './rehype.js';
import { activeSchema } from './sanitize.js';

export { remarkActive, type ActiveData, type ActiveOptions, type CalcBlock } from './plugin.js';
export { rehypeActiveKatex, rehypeActiveWrap, renderTex, katexSettings, type KatexOptions } from './rehype.js';
export { activeSchema } from './sanitize.js';
export { placeholders, substitute, texNumber, PLACEHOLDER } from './tex.js';

export type RenderOptions = ActiveOptions & KatexOptions;

export type RenderMessage = { message: string; line?: number; column?: number; severity: 'error' | 'warning' };

export type RenderResult = {
  /** Sanitized HTML, complete with default values; pass its root element to the runtime to make it live. */
  html: string;
  program: Program | undefined;
  messages: RenderMessage[];
};

/** The full untrusted-safe pipeline: Markdown (GFM, directives, math, calc) to sanitized HTML. */
export function createProcessor(options: RenderOptions = {}) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkMath)
    .use(remarkActive, options)
    .use(remarkRehype)
    .use(rehypeActiveWrap)
    .use(rehypeSanitize, activeSchema)
    .use(rehypeActiveKatex, options)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

/** Render a document. Raw HTML in the Markdown is dropped; output is sanitized before math is typeset. */
export function renderActive(markdown: string, options: RenderOptions = {}): RenderResult {
  const file = createProcessor(options).processSync(markdown);
  return {
    html: String(file),
    program: file.data.active?.program,
    messages: file.messages.map(m => ({
      message: m.reason,
      ...(m.line != null ? { line: m.line } : {}),
      ...(m.column != null ? { column: m.column } : {}),
      severity: m.ruleId === 'warning' ? 'warning' : 'error',
    })),
  };
}
