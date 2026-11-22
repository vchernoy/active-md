import type { ElementContent } from 'hast';
import type { PhrasingContent } from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import { toString } from 'mdast-util-to-string';
import type { QuizNodeTag } from './quiz-manifest.js';

type QuizDirective = ContainerDirective | LeafDirective | TextDirective;

/**
 * Turn a validated quiz directive into its control (#48). Only identities reach the HTML:
 * expected answers, tolerances and correct flags stay in the separately returned manifest,
 * which the runtime receives from the host. Buttons start disabled until the runtime mounts.
 */
export function renderQuizNode(node: QuizDirective, tag: QuizNodeTag): void {
  switch (tag.kind) {
    case 'question':
      node.data = { hName: 'fieldset', hProperties: { className: ['active-question'], dataActiveQuestion: tag.questionId, ariaLabel: `Question ${tag.number}` } };
      return;
    case 'answer':
      node.data = {
        hName: 'input',
        hProperties: { type: 'text', inputMode: 'decimal', className: ['active-answer'], dataActiveAnswer: tag.questionId, ariaLabel: 'Your answer' },
        hChildren: [],
      };
      return;
    case 'choice': {
      // The choice's own (possibly rich) label follows its radio or checkbox inside one <label>.
      const control = {
        type: 'emphasis',
        children: [],
        data: { hName: 'input', hProperties: { type: tag.type === 'single' ? 'radio' : 'checkbox', value: tag.choiceId, dataActiveChoice: tag.questionId } },
      } as unknown as PhrasingContent;
      node.data = { hName: 'label', hProperties: { className: ['active-choice'] } };
      (node.children as PhrasingContent[]).unshift(control, { type: 'text', value: ' ' });
      return;
    }
    case 'submit': {
      const label = toString(node).trim() || 'Check';
      const children: ElementContent[] = [
        { type: 'element', tagName: 'button', properties: { type: 'button', className: ['active-quiz-check'], disabled: true, dataActiveQuizLabel: label }, children: [{ type: 'text', value: label }] },
        { type: 'element', tagName: 'p', properties: { className: ['active-quiz-status'], role: 'status', ariaLive: 'polite' }, children: [] },
      ];
      node.data = { hName: 'div', hProperties: { className: ['active-quiz-submit'], dataActiveQuizGroup: tag.groupId }, hChildren: children };
      return;
    }
  }
}
