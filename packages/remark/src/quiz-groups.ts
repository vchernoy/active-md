import type { Root } from 'mdast';

type TreeNode = { type: string; name?: string; position?: Root['position']; children?: readonly TreeNode[] };
export type QuizGroupDiagnostic = { message: string; node: TreeNode };
type Question = { node: TreeNode; context: object };

/** Validate source order before any when evaluation/pruning; no rendering or grading yet. */
export function validateQuizGroups(root: Root): QuizGroupDiagnostic[] {
  const problems: QuizGroupDiagnostic[] = [];
  const pending: Question[] = [];
  // A unique terminal context identifies the exact enclosing when-node chain.
  // Reusing this identity for siblings avoids copying deep ancestor arrays.
  const stack: { node: TreeNode; context: object; question?: Question }[] = [{ node: root, context: {} }];
  const fail = (node: TreeNode, message: string) => { problems.push({ node, message }); };
  while (stack.length) {
    const frame = stack.pop()!;
    const { node } = frame;
    let { context, question } = frame;
    const directive = node.type === 'textDirective' || node.type === 'leafDirective' || node.type === 'containerDirective';
    if (node.type === 'containerDirective' && node.name === 'when') context = {};
    if (directive && node.name === 'question') {
      if (node.type !== 'containerDirective') fail(node, 'quiz question must use a :::question container');
      else {
        if (question) fail(node, 'quiz questions cannot be nested');
        const next = { node, context };
        if (!question) pending.push(next);
        question = next;
      }
    } else if (directive && node.name === 'quiz-submit') {
      if (node.type !== 'leafDirective') fail(node, 'quiz-submit must use a ::quiz-submit leaf directive');
      else if (question) fail(node, 'quiz-submit must be outside question containers');
      else {
        if (!pending.length) fail(node, 'quiz-submit has an empty question group');
        for (const item of pending) {
          if (item.context !== context) fail(item.node, 'quiz question and its submit must share the same enclosing when blocks');
        }
        pending.length = 0;
      }
    } else if (directive && (node.name === 'answer' || node.name === 'choice')) {
      const expected = node.name === 'answer' ? 'textDirective' : 'leafDirective';
      if (node.type !== expected) fail(node, `quiz ${node.name} must use a ${node.name === 'answer' ? ':answer text' : '::choice leaf'} directive`);
      if (!question) fail(node, `quiz ${node.name} must be inside a question container`);
      else if (context !== question.context) fail(node, `quiz ${node.name} must share its question's enclosing when blocks`);
    }
    const children = node.children ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ node: children[i]!, context, ...(question ? { question } : {}) });
    }
  }
  for (const item of pending) fail(item.node, 'quiz question has no following quiz-submit');
  return problems;
}
