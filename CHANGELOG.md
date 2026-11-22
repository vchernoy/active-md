# Changelog

All three packages share one version.

## 0.8.0

- Seeded quiz variants (#48): a group bound to `seed=name` draws that input within its declared range when the attempt starts and again on Retry (always a different value when the range allows), never on Check; dependents and math update. Unbound groups write no input. Optional `mount(…, { quizSeedSource })` for reproducible draws; a range with no integer leaves the group inert.
- Seeded groups show each choice question's options in a seed-derived order, reshuffled on Retry and keyed by choice identity (#48). Unseeded groups keep the authored order.
- Synchronize all three versions/internal/playground pins at exact 0.8.0.

## 0.7.0

- Render quizzes with Check / Retry (#48): with `renderActive(…, { quizManifest: true })`, valid question groups render as accessible controls carrying only identities, and `mount(root, { quiz })` grades a group against live values, shows per-question feedback and the score, freezes it, and Retry reopens only that group. The playground opts in. Seeded variants and a host attempt API follow.
- A quiz group whose manifest does not match its rendered controls stays inert; groups bound to `seed=` stay inert ("Randomized quizzes cannot be checked here yet.") until the seed lifecycle ships (#114, #115).
- Phone-plan example: the break-even sentence appears only when the plans actually cross (#113).
- Synchronize all three versions/internal/playground pins at exact 0.7.0.

## 0.6.2

- Generated footnote links now point at their sanitized ids, so footnote references and back-links scroll to their targets (#106, #110).
- Headings get safe GitHub-style ids (unique, Unicode-aware, with the sanitizer's clobber prefix), and local `#fragment` links resolve to them (#106, #111).
- Synchronize all three versions/internal/playground pins at exact 0.6.2.

## 0.6.1

- Keep colon-number text such as `3:1` or `16:10` in radio/select titles, option labels and edit/slider accessible names; Markdown had read `:1` as an unknown directive and dropped it (#100, #103).
- Open the playground's example in View on a first visit, so newcomers see the document working before its source (#101).
- Add a phone-plan comparison example (#102).
- Synchronize all three versions/internal/playground pins at exact 0.6.1.

## 0.6.0

- Add readable inline/standalone edit and slider directives with optional accessible-only bracket labels; preserve all legacy input syntax and calc-owned defaults (#90).
- Add native numeric select lists with visible labels, bounded validated choices, synchronized controls, accepted-state restoration and reset (#92).
- Extend authoring validation for quiz question/control types, expected expressions, tolerance, accepted-choice flags, seed bindings and point values (#70–#74, #80).
- Add pure identity-based answer checking, seeded choice ordering and weighted scores; opt-in bounded quiz metadata and runtime inspection/compilation/group self-check helpers (#75, #78–#79, #82–#84, #88). These do not implement quiz UI, attempt freezing, Retry or persistence.
- Isolate concurrent playground browser fixture caches (#77).
- Add native numeric radio groups with visible legends, keyboard navigation, shared choice validation, and calc-owned defaults (#85, #95).
- Refresh author/package docs and executable examples; synchronize all three versions/internal/playground pins at exact 0.6.0. Checkbox groups and button actions remain future work.

## 0.5.0

- Add deterministic seeded numeric draws and pure numeric answer checking; validate quiz groups before conditional pruning. These are foundations, not a complete quiz runtime/attempt API (#64, #65, #67).
- Add a named theme-aware prose color palette shared by sanitized rendering and optional runtime styling (#66).
- Show accessible inline input validation; preserve playground reader values across mode switches and improve phone control grouping and keyboard scrolling for wide formulas (#59–#63).
- Correct whole-count steps in sample people/night/year controls (#58).
- Fail closed when a release retry encounters package versions from a different or unknown source commit (#53).
- Synchronize all three package versions, internal dependencies and playground pins at exact 0.5.0.

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
