import GithubSlugger, { slug } from 'github-slugger';
import type { Root } from 'hast';
import { toString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';
import { activeSchema } from './sanitize.js';

/** Generate heading IDs before sanitizing, and match known local links to the final IDs. */
export function rehypeActiveHeadings() {
  return (tree: Root): void => {
    const slugger = new GithubSlugger();
    const used = new Set<string>();
    const headings = new Set<string>();
    visit(tree, 'element', node => {
      if (typeof node.properties.id === 'string') used.add(node.properties.id);
    });
    visit(tree, 'element', node => {
      if (!/^h[1-6]$/.test(node.tagName)) return;
      let id = node.properties.id;
      if (typeof id !== 'string' || !id) {
        const text = toString(node) || 'section';
        const base = slug(text) ? text : 'section';
        do { id = slugger.slug(base); } while (used.has(id));
        node.properties.id = id;
        used.add(id);
      }
      headings.add(id);
    });
    const prefix = activeSchema.clobberPrefix ?? '';
    visit(tree, 'element', node => {
      const { href, dataFootnoteRef, dataFootnoteBackref } = node.properties;
      if (node.tagName !== 'a' || typeof href !== 'string' || !href.startsWith('#') ||
          dataFootnoteRef !== undefined || dataFootnoteBackref !== undefined) return;
      let fragment: string;
      try { fragment = decodeURIComponent(href.slice(1)); } catch { return; }
      if (headings.has(fragment)) node.properties.href = `#${prefix}${fragment}`;
    });
  };
}
