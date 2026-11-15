import type { Parent, Root } from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import type { VFile } from 'vfile';

/** Inspect parsed paragraphs, so code examples and escaped punctuation stay literal. */
export function warnStrayFences(tree: Root, file: VFile): void {
  const source = String(file.value);
  const visit = (parent: Parent): void => {
    let preceding: ContainerDirective | undefined;
    for (const node of parent.children) {
      if (node.type === 'paragraph' && node.children.length === 1 && node.children[0]?.type === 'text'
        && /^:{3,}(?:\r?\n[ \t]*:{3,})*$/.test(node.children[0].value.trim())) {
        const start = node.position?.start;
        const end = node.position?.end;
        const raw = start?.offset === undefined || end?.offset === undefined ? '' : source.slice(start.offset, end.offset);
        if (/^:{3,}(?:\r?\n[ \t]*:{3,})*$/.test(raw.trim())) {
          const previousEnd = preceding?.position?.end.offset;
          const nearby = previousEnd !== undefined && start?.offset !== undefined
            && /^[\s:]*$/.test(source.slice(previousEnd, start.offset));
          const name = nearby ? `\`:::${preceding!.name}\` at line ${preceding!.position!.start.line} may have closed early` : 'a container may have closed early';
          for (const [index, fence] of raw.split(/\r?\n/).entries()) {
            const line = start!.line + index;
            const column = index === 0 ? start!.column : fence.search(/:/) + 1;
            const message = file.message(`stray '${fence.trim()}' at line ${line} — ${name}. Give the outer block a longer fence (e.g. \`::::::when\` … \`::::::\`), or combine the conditions with \`and\` instead of nesting.`, { place: { line, column } });
            message.source = 'active-md';
            message.ruleId = 'warning';
          }
          continue;
        }
      }
      if ('children' in node) visit(node as Parent);
      preceding = node.type === 'containerDirective' ? node as ContainerDirective : undefined;
    }
  };
  visit(tree);
}
