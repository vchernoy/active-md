import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';

it('positions the stray fence warning and names the outer container that closed early', () => {
  const result = renderActive(':::when[1]\n:::note[Rule of 72]\nBody\n:::\n:::');
  expect(result.messages).toEqual([expect.objectContaining({ line: 5, column: 1, severity: 'warning', message: expect.stringContaining('`:::when` at line 1 may have closed early') })]);
  expect(result.messages[0]!.message).toContain('::::::when');
  expect(result.messages[0]!.message).toContain('`and`');
});
it.each(['::::when[1]\n:::note\nBody\n:::\n::::', '::::::when[1]\n:::note\nBody\n:::\n::::::', '`:::`', '```\n:::\n```', '\\:::', 'Ordinary ::: punctuation'])('does not warn for valid fences or literal examples: %s', source => {
  expect(renderActive(source).messages).toEqual([]);
});
it('warns for standalone longer stray fences without inventing a container', () => {
  const result = renderActive(':::::');
  expect(result.messages).toEqual([expect.objectContaining({ line: 1, column: 1, severity: 'warning', message: expect.stringContaining('a container may have closed early') })]);
});
it('names a details container and does not attribute a distant stray to it', () => {
  expect(renderActive(':::details\nBody\n:::\n\n:::').messages[0]!.message).toContain('`:::details` at line 1');
  expect(renderActive(':::details\nBody\n:::\n\nOther prose\n\n:::').messages[0]!.message).not.toContain('at line 1');
});
