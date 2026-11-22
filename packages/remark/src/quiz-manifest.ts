import { DEFAULT_LIMITS } from '@vchernoy/calc';
import type { Paragraph, Root } from 'mdast';
type Node = { type: string; name?: string; attributes?: Record<string, string | null | undefined> | null | undefined; position?: Root['position']; children?: readonly Node[] };
export type QuizSource = { line: number; column: number };
export type QuizCondition = { expression: string; source: QuizSource };
export type QuizChoice = { id: string; labelSource: string; correct: boolean; source: QuizSource };
export type QuizQuestion = { id: string; points: number; source: QuizSource } & (
  { type: 'number'; expected: string; tolerance: number; relative: boolean } |
  { type: 'single' | 'multiple'; choices: QuizChoice[] }
);
export type QuizGroup = { id: string; source: QuizSource; conditions: QuizCondition[]; seed?: string; questions: QuizQuestion[] };
export type QuizManifest = { version: 1; groups: QuizGroup[] };
/** Which manifest entry a quiz directive node renders (renderer-internal; never serialized). */
export type QuizNodeTag =
  | { kind: 'question'; questionId: string; number: number; type: 'number' | 'single' | 'multiple' }
  | { kind: 'answer'; questionId: string }
  | { kind: 'choice'; questionId: string; choiceId: string; type: 'single' | 'multiple' }
  | { kind: 'submit'; groupId: string };
type Context = { parent: Context | undefined; expression: string; source: QuizSource; depth: number };
const location = (node: Node): QuizSource => ({ line: node.position?.start.line ?? 1, column: node.position?.start.column ?? 1 });

/** Capture original source before directive transforms/pruning. Validation gates publication separately. */
export function captureQuizManifest(root: Root, label: (node: Node) => string):
  { manifest: QuizManifest; nodes: ReadonlyMap<object, QuizNodeTag> } | { problem: string; source: QuizSource } {
  const groups: QuizGroup[] = [];
  const nodes = new Map<object, QuizNodeTag>();
  let pending: QuizQuestion[] = [], questionCount = 0, choiceCount = 0, chars = 0;
  const charge = (value: string) => { chars += value.length; if (chars > DEFAULT_LIMITS.maxSourceLength) throw new Error('quiz manifest exceeds the text budget'); return value; };
  const stack: { node: Node; context: Context | undefined; question: QuizQuestion | undefined; questionNode: Node | undefined }[] = [
    { node: root, context: undefined, question: undefined, questionNode: undefined },
  ];
  let source: QuizSource = { line: 1, column: 1 };
  try {
    while (stack.length) {
      const frame = stack.pop()!; const { node } = frame; source = location(node);
      let { context, question, questionNode } = frame;
      if (node.type === 'containerDirective' && node.name === 'when') {
        // Existing validation rejects depth >8; cap retained context even on invalid input.
        const depth = (context?.depth ?? 0) + 1;
        const first = node.children?.[0];
        const expression = depth <= 8 && first?.type === 'paragraph' && (first as Paragraph).data?.directiveLabel ? label(first).trim() : '';
        context = { parent: depth <= 8 ? context : undefined, expression, source, depth };
      }
      if (node.type === 'containerDirective' && node.name === 'question') {
        if (++questionCount > DEFAULT_LIMITS.maxDefinitions) throw new Error('quiz manifest exceeds the question limit');
        const type = node.attributes?.type;
        const base = { id: 'question-' + questionCount, points: node.attributes?.points === undefined ? 1 : Number(node.attributes.points), source };
        const next: QuizQuestion = type === 'single' || type === 'multiple' ? { ...base, type, choices: [] }
          : { ...base, type: 'number', expected: '', tolerance: 0, relative: false };
        if (!question) pending.push(next);
        nodes.set(node, { kind: 'question', questionId: next.id, number: questionCount, type: next.type });
        question = next; questionNode = node;
      } else if (question && node.type === 'textDirective' && node.name === 'answer' && question.type === 'number') {
        question.expected = charge(label(node).trim());
        nodes.set(node, { kind: 'answer', questionId: question.id });
        question.tolerance = node.attributes?.tolerance === undefined ? 0 : Number(node.attributes.tolerance);
        const relative = node.attributes?.relative;
        question.relative = relative === '' || relative === null || relative === 'true';
        if (questionNode?.attributes?.points === undefined && node.attributes?.points !== undefined) question.points = Number(node.attributes.points);
      } else if (question && node.type === 'leafDirective' && node.name === 'choice' && question.type !== 'number') {
        if (++choiceCount > DEFAULT_LIMITS.maxDefinitions) throw new Error('quiz manifest exceeds the choice limit');
        const correct = node.attributes?.correct;
        const choiceId = 'choice-' + (question.choices.length + 1);
        question.choices.push({ id: choiceId, labelSource: charge(label(node)),
          correct: correct === '' || correct === null || correct === 'true', source });
        nodes.set(node, { kind: 'choice', questionId: question.id, choiceId, type: question.type });
      } else if (node.type === 'leafDirective' && node.name === 'quiz-submit' && !question && pending.length) {
        const conditions: QuizCondition[] = [];
        for (let cursor = context; cursor; cursor = cursor.parent) {
          if (cursor.depth > 8) throw new Error('quiz manifest exceeds the condition depth limit');
          conditions.push({ expression: charge(cursor.expression), source: cursor.source });
        }
        const seed = node.attributes?.seed;
        nodes.set(node, { kind: 'submit', groupId: 'quiz-' + (groups.length + 1) });
        groups.push({ id: 'quiz-' + (groups.length + 1), source, conditions: conditions.reverse(),
          ...(typeof seed === 'string' ? { seed: charge(seed) } : {}), questions: pending });
        pending = [];
      }
      const children = node.children ?? [];
      for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i]!, context, question, questionNode });
    }
    const manifest: QuizManifest = { version: 1, groups };
    if (JSON.stringify(manifest).length > DEFAULT_LIMITS.maxSourceLength) throw new Error('quiz manifest exceeds the serialized budget');
    return { manifest, nodes };
  } catch (error) { return { problem: error instanceof Error ? error.message : 'quiz manifest capture failed', source }; }
}
