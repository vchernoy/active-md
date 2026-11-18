import type { QuizManifest } from './quiz-manifest.js';
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
import { rehypeActiveImages, rehypeActiveKatex, rehypeActiveWrap, type ImageOptions, type KatexOptions } from './rehype.js';
import { activeSchema } from './sanitize.js';

export { remarkActive, type ActiveData, type ActiveOptions, type CalcBlock } from './plugin.js';
export { rehypeActiveKatex, rehypeActiveWrap, renderTex, type KatexOptions } from './rehype.js';
export type { QuizManifest, QuizGroup, QuizQuestion, QuizChoice, QuizCondition, QuizSource } from './quiz-manifest.js';
export { activeSchema } from './sanitize.js';
export { mathBinding, formattedTexNumber, type MathBinding, placeholders, substitute, texNumber, katexSettings, PLACEHOLDER, type MathOutput } from './tex.js';

export type RenderOptions = ActiveOptions & KatexOptions & ImageOptions;

export type RenderMessage = { message: string; line?: number; column?: number; severity: 'error' | 'warning' };

export type RenderResult = {
  /** Sanitized HTML, complete with default values; pass its root element to the runtime to make it live. */
  html: string;
  program: Program | undefined;
  messages: RenderMessage[];
  /** Explicitly requested, bounded quiz metadata. Absent on rendering errors. */
  quiz?: QuizManifest;
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
    .use(rehypeActiveImages, options)
    .use(rehypeSanitize, activeSchema)
    .use(rehypeActiveKatex, options)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

/**
 * Render a document. Raw HTML in the Markdown is dropped, images become links (unless `images: 'load'`),
 * and output is sanitized before math is typeset.
 */
export function renderActive(markdown: string, options: RenderOptions = {}): RenderResult {
  const file = createProcessor(options).processSync(markdown);
  return {
    ...(file.data.active?.quiz && !file.messages.some(m => m.ruleId !== 'warning') ? { quiz: file.data.active.quiz } : {}),
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
