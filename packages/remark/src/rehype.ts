import type { Element, ElementContent, Root } from 'hast';
import katex from 'katex';
import type { VFile } from 'vfile';
import { katexSettings, type MathOutput } from './tex.js';

export type KatexOptions = { output?: MathOutput };

/** Render TeX to an HTML string. Never throws; KaTeX shows parse errors in place. */
export function renderTex(tex: string, displayMode: boolean, output?: KatexOptions['output']): string {
  return katex.renderToString(tex, katexSettings(displayMode, output));
}

/** Wrap the document in <div class="active-doc" data-active-calc="…"> so the runtime can find its program. */
export function rehypeActiveWrap() {
  return (tree: Root, file: VFile): void => {
    const blocks = file.data.active?.blocks ?? [];
    const doc: Element = {
      type: 'element', tagName: 'div',
      properties: { className: ['active-doc'], ...(blocks.length ? { dataActiveCalc: JSON.stringify(blocks.map(b => b.text)) } : {}) },
      children: tree.children as ElementContent[],
    };
    tree.children = [doc];
  };
}

/**
 * Typeset math marked by remarkActive. Runs after sanitizing: KaTeX output (with trust: false) is
 * inserted as raw HTML, so rehype-stringify needs allowDangerousHtml; nothing else produces raw nodes.
 */
export function rehypeActiveKatex(options: KatexOptions = {}) {
  return (tree: Root): void => {
    const visit = (node: Root | Element): void => {
      for (const child of node.children) {
        if (child.type !== 'element') continue;
        const cls = child.properties.className;
        if (Array.isArray(cls) && cls.includes('active-math')) {
          const tex = child.children.map(c => (c.type === 'text' ? c.value : '')).join('');
          child.children = [{ type: 'raw', value: renderTex(tex, child.properties.dataActiveDisplay === 'true', options.output) } as unknown as ElementContent];
          continue;
        }
        visit(child);
      }
    };
    visit(tree);
  };
}
