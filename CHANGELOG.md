# Changelog

All three packages share one version.

## 0.1.0 (unreleased)

First release (v0, see [docs/DESIGN.md](docs/DESIGN.md) §0).

### @vchernoy/calc

- `input x = n [in a..b]` and `name = expr`; numbers, `+ - * / % ^`, unary minus, parentheses.
- Built-ins: `round`, `min`, `max`, `abs`, `floor`, `ceil`, `sqrt`.
- Single assignment and define-before-use, with diagnostics and positions; errors are values.
- Limits on source size, definitions, nesting depth and evaluation steps.
- `createSession`: inputs, incremental recompute, change listeners, compiled binding expressions.
- Locale-aware `formatNumber` and `parseUserNumber`.

### @vchernoy/remark-active

- `calc` blocks, `:input[x]` (number box, slider; several per input, kept in sync), `:value[expr]{format}`.
- `{{expr}}` in `$…$` and `$$…$$`, typeset by KaTeX (MathML by default, `trust: false`).
- GFM, callouts `:::note|tip|warning|danger|important|exercise`, `:::details`.
- Untrusted-safe pipeline: raw HTML dropped, images become links, `rehype-sanitize`.
- `renderActive()` returns sanitized HTML with default values and positioned messages.

### @vchernoy/active-runtime

- `mount(root)` makes a rendered document live: controls, views and formulas update selectively.
- Range checks per control, restored-value adoption, lazy KaTeX, `destroy()`.
