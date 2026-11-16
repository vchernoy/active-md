// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';

for (const kind of ['note', 'tip', 'warning', 'danger', 'important', 'exercise', 'details']) {
  it(`preserves phrasing and typesets inline math in ${kind} titles`, () => {
    const result = renderActive(`:::${kind}[**Why** is \`x\` $x^0 = 1$?]\nBody\n:::`);
    expect(result.messages).toEqual([]);
    const root = document.createElement('div'); root.innerHTML = result.html;
    const title = root.querySelector(kind === 'details' ? 'summary' : '.callout-title')!;
    expect(title.querySelector('strong')?.textContent).toBe('Why');
    expect(title.querySelector('code')?.textContent).toBe('x');
    expect(title.querySelector('math')).not.toBeNull();
    expect(title.querySelector('math')?.textContent).toContain('x');
    expect(title.textContent).not.toContain('$');
    expect(root.querySelector('p:last-child')?.textContent).toBe('Body');
  });
}

it('keeps plain and default titles unchanged', () => {
  expect(renderActive(':::tip[Plain title]\nBody\n:::').html)
    .toContain('<p class="callout-title">Plain title</p>');
  expect(renderActive(':::details\nBody\n:::').html).toContain('<summary>Details</summary>');
  expect(renderActive(':::note\nBody\n:::').html).toContain('<p class="callout-title">Note</p>');
});

it('sanitizes title phrasing and applies the existing no-remote-images policy', () => {
  const { html } = renderActive(':::tip[![alt](https://example.invalid/pixel) <script>bad()</script> [unsafe](javascript:alert)]\nBody\n:::');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain('Image: alt');
});

it('reports title math binding errors at the original document position', () => {
  const { messages } = renderActive(':::tip[Value ${{unknown}}$]\nBody\n:::');
  expect(messages).toEqual([expect.objectContaining({ message: expect.stringContaining('unknown'), line: 1, column: 14 })]);
});
