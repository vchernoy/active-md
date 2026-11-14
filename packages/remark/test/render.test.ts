import { describe, expect, it } from 'vitest';
import { renderActive, substitute, texNumber, placeholders } from '../src/index.js';

const render = (md: string, opts = {}) => renderActive(md, { locale: 'en-US', ...opts });
const calc = (src: string) => '```calc\n' + src + '\n```\n\n';

describe('calc blocks and bindings', () => {
  it('hides calc blocks and stores their source on the document root', () => {
    const { html, program } = render(calc('input x = 2\ny = x * 3') + 'Text');
    expect(html).not.toContain('<pre');
    expect(html).toMatch(/^<div class="active-doc" data-active-calc="\[&#x22;input x = 2\\ny = x \* 3&#x22;\]">/);
    expect(program?.definitions.map(d => d.name)).toEqual(['x', 'y']);
  });

  it('shows calc blocks when asked (author view)', () => {
    expect(render(calc('x = 1'), { showCalc: true }).html).toContain('<pre><code class="language-calc">x = 1');
  });

  it('leaves documents without calc unmarked', () => {
    expect(render('Hello').html).toBe('<div class="active-doc"><p>Hello</p></div>');
  });

  it('renders :value with the default result and format', () => {
    const { html } = render(calc('input x = 1234.567\ny = x * 2') + 'A :value[y]{format=fixed:1} B :value[round(x)]');
    expect(html).toContain('<output class="active-value" data-active-value="y" data-active-format="fixed:1" aria-live="polite">2,469.1</output>');
    expect(html).toContain('data-active-value="round(x)" aria-live="polite">1,235</output>');
  });

  it('renders a number box with the range and an accessible name', () => {
    const { html } = render(calc('input n = 3 in 1..10') + ':input[n]');
    expect(html).toContain('<label class="active-input active-input-number"><input type="number" value="3" data-active-input="n" min="1" max="10" step="any" aria-label="n"></label>');
  });

  it('renders a visible label instead of aria-label when given', () => {
    const { html } = render(calc('input n = 3') + ':input[n]{label="How many"}');
    expect(html).toContain('<span class="active-input-label">How many</span><input type="number" value="3" data-active-input="n" step="any">');
  });

  it('renders a slider with its current value', () => {
    const { html } = render(calc('input r = 8 in 0..100') + ':input[r]{widget=slider}');
    expect(html).toContain('<input type="range" value="8" data-active-input="r" min="0" max="100" step="1" aria-label="r"><output class="active-value" data-active-value="r" aria-live="polite">8</output>');
    expect(render(calc('input r = 0.5 in 0..2') + ':input[r]{widget=slider}').html).toContain('step="0.02"');
    expect(render(calc('input r = 5 in 0..10') + ':input[r]{widget=slider min=2 max=8 step=0.5}').html).toContain('min="2" max="8" step="0.5"');
  });

  it('reports binding errors inline and as messages with document positions', () => {
    const md = calc('input a = 1\nb = a') + 'x :value[nope] y\n\n:input[b] :input[zz] :input[a] :input[a]';
    const { html, messages } = render(md);
    expect(messages).toEqual([
      { message: 'unknown name "nope"', line: 6, column: 3, severity: 'error' },
      { message: '"b" is not an input, so it can\'t have a control', line: 8, column: 1, severity: 'error' },
      { message: 'unknown input "zz"', line: 8, column: 11, severity: 'error' },
      { message: '"a" already has a control; show its value elsewhere with :value[a]', line: 8, column: 32, severity: 'error' },
    ]);
    expect(html).toContain('<span class="active-error" role="note">⚠ unknown name "nope"</span>');
    expect(html.match(/data-active-input="a"/g)?.length).toBe(1);
  });

  it('maps calc diagnostics to document lines', () => {
    const { messages } = render('# Title\n\n' + calc('a = 1\nb = c') + 'text\n\n' + calc('c = 2'));
    expect(messages).toEqual([{ message: '"c" is used before it is defined (line 1 of block calc-2)', line: 5, column: 5, severity: 'error' }]);
  });

  it('checks widget options', () => {
    const m = (s: string) => render(calc('input x = 5 in 0..10\ninput y = 1') + s).messages.map(e => e.message);
    expect(m(':input[x]{widget=dial}')).toEqual(['unknown widget "dial" (use number or slider)']);
    expect(m(':input[y]{widget=slider}')).toEqual(['a slider needs a range: give y "in a..b" or min and max']);
    expect(m(':input[x]{min=-5}')).toEqual(["min/max can only narrow x's range 0..10"]);
    expect(m(':input[x]{step=abc}')).toEqual(['step="abc" is not a number']);
    expect(m(':input[x]{step=0}')).toEqual(['step must be positive']);
    expect(m(':value[x]{format=money}')[0]).toMatch(/unknown format "money"/);
  });

  it('shows runtime errors as the value', () => {
    const { html, messages } = render(calc('input d = 0\nq = 1 / d') + ':value[q]');
    expect(messages).toEqual([]);
    expect(html).toContain('<output class="active-value active-error" data-active-value="q" aria-live="polite">⚠ division by zero</output>');
  });
});

describe('math', () => {
  it('substitutes {{expr}} with default values and keeps the template', () => {
    const { html } = render(calc('input x = 3\ny = x ^ 2') + 'Inline $x = {{x}}$ and\n\n$$\ny = {{y}}\n$$');
    expect(html).toContain('data-active-tex="x = {{x}}"');
    expect(html).toContain('<mn>3</mn>');
    expect(html).toMatch(/<div class="active-math active-math-display" data-active-tex="y = {{y}}" data-active-display="true"><span class="katex"><math[^>]*display="block"/);
    expect(html).toContain('<mn>9</mn>');
  });

  it('treats $$…$$ inside a line as display math', () => {
    expect(render('Before $$x^2$$').html).toContain('data-active-display="true"');
    expect(render('Before $x^2$').html).not.toContain('data-active-display');
  });

  it('marks failing expressions in math and reports them', () => {
    const { html, messages } = render('$a = {{nope}}$');
    expect(messages[0]?.message).toBe('in {{nope}}: unknown name "nope"');
    expect(html).toMatch(/<mstyle mathcolor="red"><mo[^>]*>\?<\/mo><\/mstyle>/);
  });

  it('never runs KaTeX trust features or throws on bad TeX', () => {
    const { html } = render('$\\href{javascript:alert(1)}{x}$ and $\\frac{$');
    // \href is refused (trust: false), so no link is created; the TeX source stays as text.
    expect(html).not.toMatch(/<a |href=/);
    expect(html).toContain('katex-error');
  });

  it('formats numbers for TeX', () => {
    expect(texNumber(1234.5)).toBe('1234.5');
    expect(texNumber(-2)).toBe('-2');
    expect(texNumber(1 / 3)).toBe('0.333333');
    expect(texNumber(1e21)).toBe('1\\times 10^{21}');
    expect(placeholders('a {{ x + 1 }} b {{y}}')).toEqual(['x + 1', 'y']);
    expect(substitute('{{a}}+{{b}}', [{ kind: 'value', value: 1 }, { kind: 'error', message: 'no' }])).toBe('{1}+{\\color{red}?}');
  });
});

describe('markdown and safety', () => {
  it('drops raw HTML and dangerous URLs', () => {
    const { html } = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)> [a](javascript:alert(1)) <b onclick="x">b</b>');
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:|<img|<b /);
  });

  it('keeps directive attributes from injecting markup', () => {
    const { html } = render(calc('input x = 1') + ':input[x]{label="<img src=x onerror=alert(1)>" onclick=alert(1)} :value[x]{format=fixed:0 style="color:red"}');
    expect(html).not.toMatch(/<img|onclick|style=/);
    expect(html).toContain('&#x3C;img src=x onerror=alert(1)>');
  });

  it('supports GFM', () => {
    const { html } = render('| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\n~~gone~~ https://example.com');
    expect(html).toContain('<table>');
    expect(html).toContain('<input type="checkbox" checked disabled>');
    expect(html).toContain('<del>gone</del>');
    expect(html).toContain('<a href="https://example.com">');
  });

  it('renders callouts and details', () => {
    const { html } = render(':::warning\nCareful\n:::\n\n:::note[Heads up]\nText\n:::\n\n:::details[More]\nHidden\n:::');
    expect(html).toContain('<aside class="callout callout-warning" role="note"><p class="callout-title">Warning</p><p>Careful</p></aside>');
    expect(html).toContain('<p class="callout-title">Heads up</p>');
    expect(html).toContain('<details><summary>More</summary><p>Hidden</p></details>');
  });

  it('puts unknown directives back as text', () => {
    expect(render('Note:this and :span[x]{.a} 10:30').html).toBe('<div class="active-doc"><p>Note:this and :span[x]{.a} 10:30</p></div>');
    expect(render('::video{src=x}').html).toBe('<div class="active-doc"><p>::video{src=x}</p></div>');
    expect(render(':::toString\nx\n:::').html).toContain(':::toString');
  });
});

describe('review fixes (#4)', () => {
  it('turns images into links so nothing loads until the reader clicks', () => {
    const { html } = render('![pixel](https://attacker.example/p.png) ![](//cdn.example/x.png) ![rel](img/a.png)');
    expect(html).not.toMatch(/<img|<picture|<source|src=/);
    expect(html).toContain('<a href="https://attacker.example/p.png" class="active-image" rel="nofollow noopener noreferrer">Image: pixel</a>');
    expect(html).toContain('<a href="//cdn.example/x.png" class="active-image" rel="nofollow noopener noreferrer">Image: image</a>');
    expect(html).toContain('>Image: rel</a>');
    // Trusted hosts can keep images.
    expect(render('![a](https://example.com/a.png)', { images: 'load' }).html).toContain('<img src="https://example.com/a.png" alt="a">');
  });

  it('reads binding expressions as written, even where Markdown sees emphasis', () => {
    const { html } = render(calc('input a = 2') + ':value[2*3*4] :value[a*a*a] :value[a * 3 * a]');
    expect(html).toContain('data-active-value="2*3*4" aria-live="polite">24</output>');
    expect(html).toContain('data-active-value="a*a*a" aria-live="polite">8</output>');
    expect(html).toContain('data-active-value="a * 3 * a" aria-live="polite">12</output>');
    expect(render(calc('input x_y = 1') + ':input[x_y]').html).toContain('data-active-input="x_y"');
  });

  it('keeps substituted numbers as one TeX group', () => {
    expect(substitute('x^{{n}} \\sqrt{{n}}', [{ kind: 'value', value: 12 }, { kind: 'value', value: 25 }])).toBe('x^{12} \\sqrt{25}');
    const { html } = render(calc('input n = 12') + '$x^{{n}}$');
    expect(html).toContain('<msup><mi>x</mi><mn>12</mn></msup>');
  });

  it('maps calc diagnostic columns through indentation and quotes', () => {
    expect(render('  ```calc\n  a = nope\n  ```').messages).toEqual([{ message: 'unknown name "nope"', line: 2, column: 7, severity: 'error' }]);
    expect(render('> ```calc\n> a = nope\n> ```').messages).toEqual([{ message: 'unknown name "nope"', line: 2, column: 7, severity: 'error' }]);
    expect(render('- item\n\n  ```calc\n  b = 1\n  a = nope\n  ```').messages).toEqual([{ message: 'unknown name "nope"', line: 5, column: 7, severity: 'error' }]);
  });
});

describe('review fixes (#4, second round)', () => {
  it('rejects reversed control bounds and bounds that exclude the starting value', () => {
    const m = (s: string) => render(calc('input x = 5 in 0..10') + s).messages.map(e => e.message);
    expect(m(':input[x]{widget=slider min=8 max=2}')).toEqual(['min 8 is greater than max 2']);
    expect(m(':input[x]{widget=slider min=8 max=10}')).toEqual(["x starts at 5, outside this control's range 8..10"]);
    expect(m(':input[x]{max=3}')).toEqual(["x starts at 5, outside this control's range 0..3"]);
    expect(render(calc('input y = 5') + ':input[y]{min=6}').messages[0]?.message).toBe("y starts at 5, outside this control's range 6..…");
    expect(m(':input[x]{widget=slider min=2 max=8}')).toEqual([]);
  });

  it('reports evaluation errors in math bindings, with their position', () => {
    const { messages } = render(calc('input d = 0\nq = 1 / d') + 'Then $q = {{q}}$ and $${{q + 1}}$$');
    expect(messages).toEqual([
      { message: 'in {{q}}: division by zero', line: 6, column: 6, severity: 'error' },
      { message: 'in {{q + 1}}: depends on an error in q', line: 6, column: 22, severity: 'error' },
    ]);
  });
});
