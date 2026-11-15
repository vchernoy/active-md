# Changelog

All three packages share one version.

## 0.1.3 (unreleased)

- Runtime number controls use a bounded character width derived from range, starting value and decimal step; unbounded controls retain the default.
- Preserve native centered MathML matrix positions by removing the center-column override (#27).
- All packages and internal dependencies are prepared at exact 0.1.3. Publication is a separate maintainer action through the Actions release workflow.

## 0.1.2

- Optional `@vchernoy/active-runtime/style.css`: scoped compact inputs, invalid-input outline and native MathML column alignment; consumed by the playground.
- `{{expr | spec}}` math placeholders share `:value` formats and locale-aware, TeX-safe substitution for server defaults and runtime updates. Existing `{{expr}}` output is unchanged; invalid formats report positioned diagnostics.
- All three packages and internal dependencies are pinned to 0.1.2; published through the Actions release workflow.

## 0.1.1 (2026-11-14)

No code changes. This release was made to verify token-free npm trusted publishing (OIDC) through `publish.yml`. It is published with provenance.

## 0.1.0 (2026-11-14)

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
