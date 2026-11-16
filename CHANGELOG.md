# Changelog

All three packages share one version.

## Unreleased

- Parenthesize negative/compound numeric math placeholders before powers and after binary operators, preserving plain positive values, authored grouping and text-mode labels (#30).

- Add validated runtime `initialInputs` restoration for rendered/model-only inputs before refresh, synchronize programmatic model changes with peer controls, and expose `resetInputs()` for authored defaults and stale-error cleanup (#54).

- Preserve Markdown phrasing and typeset inline math in callout titles and details summaries, including live calc placeholders and conditional laziness (#32).

## 0.4.0

- Omit proven-false `when` subtrees and their runtime binding data before serialization (#46), preserving live initially hidden conditions, nested updates, source validation and lazy errors.

- Prepare calc definitions and document expressions with conservative constant propagation, range comparison proofs and lazy branch elimination (#45). Keep live dependencies, source diagnostics and evaluation-limit behavior; expose proven constant conditions to rendering.

## 0.3.0

- Logarithmic, exponential and trigonometric calc functions, angle conversions and shadowable `pi`/`e` constants (#41, #43). Invalid domains and nonfinite results use positioned errors; existing evaluation budgets remain in force.
- Positioned stray-container-fence warnings, including consecutive leftover lines, with guidance on longer outer fences and combined conditions (#40, #42).
- Documented radians, domains, constant shadowing, cross-engine approximation differences, and exact doubling-time versus Rule of 72 examples.
- All three packages, internal dependencies and playground pins are prepared at exact 0.3.0. Publishing uses the Actions release workflow.

## 0.2.0

Conditions (#31):

- Numeric comparisons, short-circuit logic, lazy multi-branch `if`, and rounded negative-safe `even`/`odd`; exact equality and existing deterministic budgets.
- Sanitized retained `:::when` blocks, nested visibility to depth 8, positioned condition/structural errors, and lazy hidden bindings. Calc blocks inside `when` are rejected; hidden controls retain global values.
- Positioned static self-hiding-control errors through transitive/enclosing dependencies and cross-block cycle warnings.
- Powers and roots example, including zero-safe formulas and the hidden-input `if()` gating pattern.

Styles and controls (typebridge#302; never released as 0.1.3):

- Share the playground callout palette, tinted backgrounds and title styles through optional scoped runtime CSS with overridable `--active-callout-*` variables and light/dark defaults.
- Optional stylesheet prefers locally installed STIX Two Math, Cambria Math and Latin Modern Math, with generic math fallback; no bundled fonts or requests.
- Runtime number controls use a bounded character width derived from range, starting value and decimal step; unbounded controls retain the default.
- Preserve native centered MathML matrix positions by removing the center-column override (#27).

- All three packages and internal dependencies are pinned to 0.2.0.

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
