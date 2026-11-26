# active-md

Markdown + LaTeX with **live calculations and form controls**: inputs the reader can change, results that update, and formulas typeset with current values. For courses, it adds questions whose answers are checked.

It's built for authors writing prose, and it's safe for documents that anyone may have written: no JavaScript in documents, no `eval`, no network.

**Status:** 0.11.0 release documentation (publication is verified through the release workflow). Try it in the **[playground](https://vchernoy.xyz/active-md/)**: one editor, one Edit/View switch, share links that keep the document in the URL. See [docs/DESIGN.md](docs/DESIGN.md), especially §0 (Version 0).

## Example

````markdown
```calc
input principal = 100000 in 0..100000000
input rate = 8 in 0..100        // % per year
input years = 10 in 1..50
final = principal * (1 + rate / 100) ^ years
```

Investing :edit{input=principal} at :slider[Annual interest rate]{input=rate step=0.5}% for :edit[Years]{input=years step=1} years
gives **:value[final]{format=fixed:0}**.

$$ P_n = {{principal}} \cdot (1 + {{rate}}/100)^{ {{years}} } = {{final | fixed:2}} $$
````

More: **[examples/](examples/)** contains complete calculators using readable controls, radio groups and dropdowns, plus an explicit compatibility comparison. Every example is rendered in CI.

## Readable controls (0.6.0)

For new documents, use `:edit{input=principal}` and
`:slider[Annual interest rate]{input=rate step=0.5}`. Both inline (`:`) and
standalone (`::`) forms work. Optional bracket text supplies an accessible name,
without inserting a visible label into prose. Standalone `::edit` and
`::slider` display their explicit bracket labels. Omission uses the input name.
Defaults remain in calc. Use package version 0.6.0 or later for these forms.

Existing `:input[principal]` and `:input[rate]{widget=slider}` remain supported
with identical behavior, including the legacy visible `label` attribute. No
migration or source rewriting is required. See [the readable controls example](examples/readable-controls.md).

## Conditions (0.2)

`if(x != 0, 1/x, 0)` evaluates only the selected branch. Multi-branch `if(c1, a, c2, b, otherwise)`, comparisons, `and`/`or`/`not` and `even`/`odd` all use numeric truth (zero false). Equality is exact; use `abs(a-b) < 1e-9` for tolerance. `%` is JavaScript remainder, so `-3 % 2` is -1; parity tests round first and handle negatives.

```markdown
:::when[x != 0]
The reciprocal is :value[1/x].
:::
```

Declare calc outside these containers. Calc prepares immutable constants and range-proven comparisons before rendering. Proven-false conditional subtrees are omitted from HTML, including their runtime bindings. Conditions that can change remain in HTML with `hidden` when false, and their content is not evaluated until visible. Source and the global calc program remain available; this is not an authorization boundary. Nested blocks require every enclosing condition (maximum depth 8). Hidden controls keep their values: gate their contribution with `if(useExtra, extra, 0)`. Keep a control outside any condition that depends on that input; self-hiding controls are errors and cross-block control cycles are warnings. See [powers and roots](examples/powers-and-roots.md) and [the design](docs/DESIGN.md) for the full rules. No `else` or `choose` in this release.


Prefer one condition, such as `:::when[rate > 0 and years > 5]`, over two nested `when` blocks when both conditions gate the same content. A callout or `details` directly inside a `when` needs only one extra colon on the outer `when` (`::::when` around `:::note`); only a `when` inside another `when` adds another conditional level. Increase outer fences for each container level, including callouts/details.

Outer fences may be longer than required. Start with five or six colons (`::::::when[…]` … `::::::`) to leave room for adding inner containers later. See [the generous-fence example](examples/generous-fences.md). A paragraph consisting only of three or more colons produces a positioned warning naming the nearby container that may have closed early and suggesting a longer outer fence or combining conditions with `and`. Code spans and fenced code remain literal; warnings do not repair fences or remove source content.

## Math functions (0.3)

`ln(x)` is natural log; `log(x)` is base 10 and `log(x, base)` selects a base. Use `exp`, `sin`/`cos`/`tan`, `asin`/`acos`/`atan`/`atan2(y, x)`, and `deg`/`rad` for unit conversion. Trig functions use radians. `pi` and `e` are constants; a document definition shadows either with a positioned warning and ordinary define-before-use rules. Invalid domains and nonfinite results are positioned error values. Engines can differ in the last bit: compare approximate results with `abs(a - b) < 1e-9` rather than exact equality.

## Packages

| Package | What it is |
|---|---|
| `@vchernoy/calc` | The calc language: parse, evaluate, sessions. Pure TypeScript, no dependencies, no DOM. |
| `@vchernoy/remark-active` | A remark plugin: calc blocks, `:input`, `:value`, `{{…}}` in math |
| `@vchernoy/active-runtime` | A browser runtime that makes the rendered page live |
| `@vchernoy/active-react` | A React/MDX wrapper (later) |

`apps/playground` is the GitHub Pages app: `npm run dev -w apps/playground`.

### Install

```sh
npm install --save-exact @vchernoy/remark-active @vchernoy/active-runtime
```

```ts
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '@vchernoy/active-runtime';

container.innerHTML = renderActive(markdown).html; // sanitized, default values filled in
mount(container);                                   // make it live
```

### Releasing

All packages share one version. Set it in each `packages/*/package.json` (and the internal dependencies), update `CHANGELOG.md`, run `npm run build && npm run release:check` and merge. Then start the `release` workflow: **Actions → release → Run workflow** on `main` with the version (for example `0.1.2`), or push a tag yourself (`git tag v0.1.2 && git push origin v0.1.2`). The workflow tests, checks and publishes to npm with provenance; a run started from Actions then tags the published commit.

Before publishing any package, the workflow checks all existing versions on npm. It skips a version only when its `gitHead` matches the exact release commit. To resume a partial release, re-run the original failed workflow on its original commit; starting a new run from a later `main` commit is refused even if the package versions are unchanged. Missing source metadata or registry lookup failures also stop the release before publishing or tagging; investigate these manually rather than bypassing the check.

Publishing uses **npm trusted publishing** (OIDC). No npm token or secret is stored. Each package on npmjs.com lists `vchernoy/active-md` and the workflow `publish.yml` as its trusted publisher (Settings → Trusted publishing → GitHub Actions). If the workflow file is renamed, update the trusted publisher on all three packages, otherwise the next publish is refused. A **new** package (one that doesn't exist on npm yet) needs its first version published another way before a trusted publisher can be added.

## Integrations

- [TypeBridge](https://github.com/vchernoy/typebridge): uses ActiveMD for rendered Markdown documents and shareable pages with live calculations and controls. See its [current package pins](https://github.com/vchernoy/typebridge/blob/main/package.json).
- [course-platform](https://github.com/vchernoy/course-platform): integration for websites, blogs, lessons and tests remains planned; tracked in [#1](https://github.com/vchernoy/active-md/issues/1).

Version 0.6.0 includes additional quiz authoring checks and pure quiz helpers. Version 0.7.0 renders quizzes with Check / Retry (opt-in `quizManifest`), and 0.8.0 adds seeded variants drawn on each attempt with seed-ordered choices. Version 0.9.0 adds an `onQuizAttempt` completed self-check notification; draft/checked-attempt restore remains planned in [#48](https://github.com/vchernoy/active-md/issues/48).

## License

MIT

In math, `{{expr}}` retains its original numeric TeX output; `{{expr | fixed:2}}` uses locale-aware formatting, like `:value[expr]{format=fixed:2}`. Supported specs are `auto`, `int`, `fixed` (short for `fixed:0`), `fixed:N` and `percent:N` (N:0–15). Commas and percent signs are TeX-escaped, locale spacing becomes a thin space. Invalid specs show a red `?` with a positioned renderer diagnostic. Only placeholders are live; literal numbers stay as authored.

## Numeric select lists (0.6.0)

Use `:::select[Delivery]{input=delivery}` with direct
`::option[Standard]{value=10}` children and a closing `:::`. Declare the default in
calc, matching one of the finite numeric option values. Labels are visible text;
exactly one option is selected. See [the delivery example](examples/select-control.md).
Controls sharing the binding stay synchronized; unlisted values are rejected by the
mounted session and incompatible restored values keep the authored default. Pure calc
sessions retain their model ranges. Use version 0.6.0 or later.


````markdown
```calc
input delivery = 10 in 0..25
```

:::select[Delivery]{input=delivery}
::option[Standard]{value=10}
::option[Express]{value=25}
::option[Pickup]{value=0}
:::

Delivery costs :value[delivery].
````

Edit/slider brackets are optional accessible names, without extra visible prose.
Select brackets and option brackets are visible labels. Defaults always belong in
calc. Keep `:value[expression]` for outputs. Existing `:input[name]` and its visible
`label` attribute remain supported; no document migration is required.

Use `:::radio[Delivery]{input=delivery}` with the same options for native radio
buttons under a visible legend. Both choice controls use calc defaults for reset
and for saved values no longer offered. Version 0.9.0 accepts proven constant expressions in input defaults, range endpoints, option values and numeric control attributes. Version 0.10.0 also accepts constant `{{expression}}` in bracket labels. Control labels also accept the same optional format suffix as math, for example `{{base | fixed:2}}`. Inside an option label, `{{value}}` refers to that option’s declared number. See the [radio example](examples/radio-control.md) and [trip budget](examples/trip-budget.md).

Checkbox collections and button assignment actions remain proposals. Complete quiz submission/Retry
UI also remains future work (#48); pure self-check helpers do not provide it.
