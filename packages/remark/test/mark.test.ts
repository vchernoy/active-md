import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { renderActive } from '../src/index.js';
it.each(['red', 'green', 'blue', 'orange', 'purple', 'gray'])('renders the fixed %s palette class with inline Markdown', color => {
  const result = renderActive(`:mark[**Strong** and \`code\` $x^2$]{color=${color}}`);
  expect(result.messages).toEqual([]);
  const { document } = new JSDOM(result.html).window;
  const span = document.querySelector(`span.active-mark-${color}`)!;
  expect(span.querySelector('strong')?.textContent).toBe('Strong');
  expect(span.querySelector('code')?.textContent).toBe('code');
  expect(span.querySelector('math')).not.toBeNull();
  expect(span.hasAttribute('style')).toBe(false);
});
it.each([':mark[text]', ':mark[text]{color=yellow}', ':mark[text]{color="rgb(1,2,3)"}',
  ':mark[text]{color=red style="position:fixed"}', ':mark[text]{color=red onclick="alert(1)"}'])('rejects unsupported authoring with source positions: %s', text => {
  const result = renderActive('Intro\n\n' + text);
  expect(result.messages[0]).toMatchObject({ severity: 'error', line: 3, column: 1, message: expect.stringContaining('mark') });
  expect(result.html).not.toContain('active-mark-');
  expect(result.html).not.toMatch(/style=|onclick=/);
});
it('preserves safe links and strips unsafe URLs/raw HTML inside marks', () => {
  const result = renderActive(':mark[[safe](https://example.com) [bad](javascript:alert%281%29) <script>alert(1)</script>]{color=blue}');
  const { document } = new JSDOM(result.html).window;
  expect(document.querySelector('.active-mark-blue a')?.getAttribute('href')).toBe('https://example.com');
  expect(document.querySelector('script')).toBeNull();
  expect(result.html).not.toContain('href="javascript:');
});
