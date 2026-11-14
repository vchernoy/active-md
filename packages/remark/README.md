# @vchernoy/remark-active

The Markdown side of [active-md](../../README.md): a remark plugin and a ready-made, sanitized pipeline.

```ts
import { renderActive } from '@vchernoy/remark-active';

const { html, messages } = renderActive(markdown, { locale: 'en-US' });
// html: sanitized HTML, complete with default values (no JavaScript needed to read it)
// messages: [{ message, line, column, severity }] for the author
```

## What it handles

- ` ```calc ` blocks: collected in document order into one program (`@vchernoy/calc`), hidden from readers (`showCalc: true` shows them as code).
- `:input[name]` is a number box. Add `{widget=slider}` for a slider, with `min`, `max` and `step` (they may only narrow the input's range) and `label="…"`. An input may have several controls (say a number box and a slider): they stay in sync and must use the same range.
- `:value[expr]{format=fixed:2|percent:1|int}`: a read-only view of a value or expression.
- `{{expr}}` inside `$…$` and `$$…$$` inserts the value; formulas are typeset by KaTeX as MathML (`output: 'htmlAndMathml'` if the page loads KaTeX's CSS). `$$…$$` written inside a line is display math.
- GFM, plus callouts `:::note|tip|warning|danger|important|exercise` (optional `[Title]`) and `:::details[Summary]`.
- Unknown directives (`Note:this`, `:span[x]`) are put back as the text they came from.

Errors appear inline (`⚠ message`) and as `messages` with document line and column.

## Safety

Raw HTML in the Markdown is dropped. Output goes through `rehype-sanitize` (GitHub's schema plus the elements and `data-active-*` attributes this plugin emits) before KaTeX runs with `trust: false`. Calc has no access to anything but numbers.

## Output for the runtime

The document is wrapped in `<div class="active-doc" data-active-calc="[…calc sources…]">`. Controls carry `data-active-input`, views `data-active-value` (and `data-active-format`), and math `data-active-tex` with the `{{…}}` template. `@vchernoy/active-runtime` reads these to make the page live.

## Using the plugin in your own pipeline

`remarkActive(options)` goes after `remark-directive` and `remark-math`; add `rehypeActiveWrap` after `remark-rehype`, then your sanitizer (extend `activeSchema`), then `rehypeActiveKatex`. See `createProcessor` in `src/index.ts`.
