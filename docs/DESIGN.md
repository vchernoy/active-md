# active-md: design

Status: **draft for discussion**. Nothing here is implemented yet; §0 is the first release.
Consumers: **TypeBridge** (vchernoy/typebridge) and **course-platform** (vchernoy/course-platform).

## 0. Version 0 (first release)

Small, safe and usable as soon as possible in both course-platform and TypeBridge. Everything later in this document stays the direction; v0 is the subset that ships first.

- **Markdown with directives, not MDX.** MDX compiles to JavaScript and runs it. That's fine for trusted course authors, but not for TypeBridge share links, which anyone can write. The v0 plugin is a remark plugin, so it works in a plain remark pipeline (TypeBridge, sanitized) and inside course-platform's existing MDX pipeline.
- **Markdown:** GFM (tables, task lists, strikethrough, autolinks), plus callouts `:::note|tip|warning|danger|important|exercise` and `:::details[Title]`, as course-platform already has.
- **LaTeX:** `$…$` and `$$…$$`, rendered by KaTeX.
- **Calc, minimal:**
  - `input x = 5`, a number with a default, and optional `in a..b`;
  - `y = expr`;
  - numbers only;
  - `+ - * / ^`, unary `-`, parentheses;
  - `round(x, digits)`, `min`, `max`, `abs`, `floor`, `ceil`, `sqrt`;
  - single assignment and define-before-use;
  - errors shown inline, with source positions.
- **Bindings:**
  - `:input[x]`, a number box;
  - `:input[x]{widget=slider min=… max=… step=…}`;
  - `:value[expr]{format=…}`, read-only;
  - `{{expr}}` inside math.
- **Not in v0:**
  - functions;
  - lists and tables generated from them;
  - `missing`;
  - `if`/`cond`;
  - quizzes;
  - text, bool and select inputs;
  - automatic typesetting of a formula's definition (`$$ {{name}} $$`), so `{{…}}` in math always inserts a value.

## 1. Purpose

Write documents in **Markdown + LaTeX** that also contain **live calculations and form controls**:

- inputs the reader can change;
- results that update;
- formulas typeset with current values;
- tables filled from calculated lists;
- for courses, questions whose answers are checked.

It's built for authors writing prose, not for programmers writing code.

**Concrete targets:**

- **course-platform:** websites, blogs, pages, lessons and tests. The first real example is replacing the hand-written `CompoundInterestCalculator` React component with authored Markdown.
- **TypeBridge:** a `markdown` / `markdown+calc` document format with a rendered view, and share links whose content anyone may have written.

## 2. Goals and non-goals

**Goals:**

- **Safe for untrusted documents:**
  - no JavaScript in documents;
  - no `eval`;
  - no network;
  - bounded computation.
- **Readable calculations:** top-down, single assignment, no hidden state.
- **Separate layers:**
  - a pure **calc language** with no Markdown, DOM or LaTeX;
  - a **Markdown plugin** in the unified/remark ecosystem;
  - a small **browser runtime**.
- **Works on the server and in the browser:** values computed from the defaults are in the HTML from the first render, and the runtime then makes the page live.
- **Clear diagnostics:** every error points at a source position and is shown inline, never as a broken page.
- **Extensible by trusted hosts:** extra functions and components can be registered.

**Non-goals:**

- general-purpose programming;
- side effects;
- mutable state;
- I/O;
- full LaTeX documents;
- symbolic algebra (simplify or solve) in v1–v3;
- computing from LaTeX source;
- storing reader input inside documents.

## 3. Concepts

| Concept | Defined in | Notes |
|---|---|---|
| **Model** | `calc` blocks, read in document order | The program: inputs, definitions, functions |
| **Input** | `input x: number = 100 in 0..1000` | The reader can change its value. It has a type, an optional default, an optional range and an optional "may be missing". |
| **Definition** | `y = 10 * x` | An immutable value, recomputed when what it depends on changes |
| **Function** | `f(a, b) = a * b + rate` | At least one parameter. Pure. Can use names defined above it. |
| **Binding** | Markdown directive | Connects a name or expression to a place in the text |
| **Control** | `:input[x]` | The **one** editable binding of an input: widget, label, step, format |
| **View** | `:value[y]`, `{{y}}` in math, table cells | Read-only. Any number of them. |

**Rules:**

1. **Single assignment.** Each name is defined exactly once. Function clauses (§4.6) on consecutive lines count as one definition.
2. **Define before use.** Inside the model, an expression may use only names defined **above** it, in the same or an earlier calc block. Cycles are therefore impossible. The exception is a function referring to itself (v3, §4.7).
3. **Bindings may refer to anything.** The text is rendered after the whole model is evaluated, so "**Total:** :value[total]" may come before `total` is defined.
4. **An input may have several controls,** for example a number box and a slider. They all edit the same value and stay in sync, so they must use the same range (their steps may differ). Read-only views of an input are allowed anywhere.
5. **An input without a control** keeps its default, or stays missing.
6. **No zero-parameter functions.** Write `y = …`, not `y() = …`. Values are already live, so the two would mean the same thing.

## 4. The calc language

### 4.1 Lexical rules

- **Comments:** `// to end of line`.
- **Names:**
  - letters (Latin and Cyrillic), digits and `_`, not starting with a digit;
  - case-sensitive;
  - keywords are reserved: `input`, `in`, `if`, `cond`, `else`, `true`, `false`, `missing`, `and`, `or`, `not`.
- **Numbers in source:**
  - a `.` decimal point: `1500.5`;
  - optional `_` separators: `1_500_000`;
  - exponents: `1e-3`.

  Locale formats like `1 500,5` apply only to **display and reader input**, never to source.
- **Text:**
  - double quotes: `"Москва"`;
  - escapes: `\"`, `\\`, `\n`.
- **Lists:** `[1, 2, 3]`, from v2.
- **One definition per line.** A definition may continue onto the next lines while a bracket is still open.

### 4.2 Definitions and inputs

```calc
input people: int = 2 in 1..10      // type, default, range
input rate: number = 5.5 in 0..100  // percent
input weight: number                // no default: missing until the reader enters it
input city: text = "Казань" in ["Казань", "Москва", "Сочи"]   // a choice
input agree: bool = false

rooms = ceil(people / 2)
stay = 5200 * 3 * rooms
cost(n) = n * 1500                  // a function
```

- **Input types:**
  - `number`;
  - `int`;
  - `bool`;
  - `text`;
  - `text in [...]`, a choice from a list.

  Ranges are `a..b`, with both ends included.
- **The default must satisfy the type and range,** or the model has an error.

### 4.3 Values and their three states

Types are `number`, `bool`, `text` and `list` (v2). Records come later.

Every name evaluates to exactly one state:

| State | When | Spreads | Display |
|---|---|---|---|
| **value** | It computed normally | — | Formatted value |
| **missing** | An input with no value, or anything depending on one | Yes, unless handled with `default(x, d)` or `isMissing(x)` | A placeholder: `—`, or the binding's `placeholder` text |
| **error** | Division by zero, a bad argument, a type mismatch, a limit exceeded, a value out of range | Yes, as "depends on an error in `name`" | An inline message, with the source position in the author's view |

Missing is not an error: a form that hasn't been filled in yet is a normal state.

### 4.4 Operators, from lowest to highest precedence

| Precedence | Operators |
|---|---|
| 1 | `or` |
| 2 | `and` |
| 3 | `not` |
| 4 | `==` `!=` `<` `<=` `>` `>=` |
| 5 | `+` `-` |
| 6 | `*` `/` `%` |
| 7 | unary `-` |
| 8 | `^` (right-associative) |
| 9 | call `f(x)`, index `a[i]` (v2) |

- `×` and `÷` are accepted as `*` and `/`.
- Comparisons can't be chained.

### 4.5 Conditionals (v1)

Only the chosen branch is evaluated:

```calc
fee = if(total > 10000, 0, 300)
sign(x) = cond(x < 0 -> -1, x == 0 -> 0, else -> 1)
```

### 4.6 Functions with clauses (v2)

```calc
f(0, 0) = 1
f(1, n) = n
f(m, n) = m + n      // tried top to bottom; the first clause that matches wins
```

- **Patterns:**
  - number or text literals;
  - a parameter name;
  - `_`, which matches anything.
- **Guards** are not in v2: use `cond` in the body.
- **No clause matches:** that's an error.
- **Clauses must be consecutive.** The same name appearing again later is "defined twice".

### 4.7 Recursion (v3, optional)

A function may call itself only within its own clauses. Calls are limited by `maxDepth` (default 256) and `maxSteps` (§4.10). Most documents should not need recursion: lists with `map`, `scan` and `fold` cover loops.

### 4.8 Lists (v2)

```calc
months = range(1, 12)
balance = scan(months, 0, (b, m) => b * (1 + rate / 100) + monthly)   // a running value
total = last(balance)
m = [[1, 2], [3, 4]]       // a matrix is a list of lists
```

Lambdas `(a, b) => expr` exist only as arguments to built-in functions. They can't be stored in a name in v2.

### 4.9 Built-in functions

- **v1:**
  - `round(x, digits=0)`, `floor`, `ceil`, `abs`;
  - `min(...)`, `max(...)`, `sqrt`, `exp`, `ln`, `log10`, `pow`;
  - `if`, `cond`;
  - `default(x, d)`, `isMissing(x)`;
  - `clamp(x, lo, hi)`;
  - `random(seed, lo, hi)` and `randomInt(seed, lo, hi)`: deterministic, so the same seed always gives the same result.
- **v2:**
  - `range(a, b, step=1)`, `len`, `sum`, `product`, `avg`;
  - `map`, `filter`, `fold`, `scan`;
  - `first`, `last`, `at(list, i)`, `zip`;
  - `join(list, separator)`, `text(x, format)`.
- **v3:**
  - matrix built-ins: `transpose`, `matmul`, `det`, `inverse`;
  - finance: `pmt`, `fv`, `pv`, `npv`, `irr`;
  - date arithmetic.

### 4.10 Limits

All limits are configurable by the host.

| Limit | Default |
|---|---|
| Calc source size | 64 KB |
| Definitions | 2,000 |
| Steps per full evaluation (`maxSteps`) | 1,000,000 |
| List length | 10,000 |
| Rows in a generated table | 1,000 |
| Recursion depth (v3) | 256 |

Going over a limit is an **error** in the affected name. It never freezes the page.

### 4.11 Determinism

- No clock and no `Math.random`: the same program and inputs always give the same values.
- Randomness comes only from `random(seed, …)`, with the seed supplied as an input. For example, course-platform sets `seed` from student and attempt.

## 5. The `@vchernoy/calc` API

```ts
parse(blocks: { id: string; text: string }[]): { program: Program; diagnostics: Diagnostic[] }
// Program: ordered definitions, inputs, functions, dependency graph, source spans
program.inputs        // [{ name, type, default?, range?, choices?, optional }]
program.names         // Map<name, { kind: 'input' | 'value' | 'function', span }>

evaluate(program, inputs: Record<string, unknown>, options?): Values    // pure; each name → value | missing | error

createSession(program, options?: { limits, functions, locale }): Session
session.set({ people: 3 })                 // partial update; returns the names whose values changed
session.get(name) / session.values()
session.subscribe(names, callback)
session.evaluateExpression('share(stay, people)')   // for bindings that use an expression

toLatex(program, name, values?)            // a definition typeset as LaTeX, optionally with values
format(value, spec, locale)                // number, percent, currency, fixed digits
parseUserNumber(text, locale)              // reader input "1 500,5" → 1500.5, or an error
checkAnswer(expected, given, { tolerance?, relative? })   // for quizzes
```

**Requirements:**

- no dependencies;
- no DOM;
- runs in Node and the browser;
- exhaustive unit and property tests.

## 6. Markdown syntax

The plugin is built on **unified/remark**: `remark-directive`, `remark-math`, `remark-gfm`. This is the stack course-platform already uses.

````markdown
---
active: 1          # language version
---

# Поездка в Казань

```calc
input people: int = 2 in 1..10
input nights: int = 3 in 1..30
rooms = ceil(people / 2)
stay = 5200 * nights * rooms
share = round(stay / people)
```

**На человека:** :value[share]{format=currency} — **жильё:** :value[stay] ₽

Нас: :input[people]{widget=slider label="Сколько человек"} · ночей: :input[nights]

$$ {{share}} $$                                  <!-- the formula of share, drawn automatically, with its value -->
$$ \frac{ {{stay}} }{ {{people}} } = {{share}}\,₽ $$   <!-- hand-written LaTeX with live values -->

:::table{for="m in range(1, nights)"}
| Night | Total so far |
|-------|--------------|
| {{m}} | {{5200 * m * rooms}} |
:::
````

### Directives

| Directive | Kind | Attributes |
|---|---|---|
| `:input[name]` | A control for an input (several may edit the same input, kept in sync) | `widget` = `number` \| `slider` \| `select` \| `checkbox` \| `text`; `label`; `step`; `min`/`max` (only to narrow the model's range); `placeholder`; `format` |
| `:value[expr]` | A read-only view | `format` (`number` \| `percent` \| `currency` \| `fixed:2`…); `placeholder` (for missing) |
| `::table{columns="a, b"}` / `:::table{for="x in list"}` | A table generated from lists (v2) | `columns`; `for`, with a template row; `max` |
| `:answer[expr]` | A quiz answer box (§8) | `tolerance`, `relative`, `points`, `feedback` |

### Inside math

- **`{{name}}` on its own inside `$$…$$`** typesets that name's definition as LaTeX, with its value: `name = …formula… = value`. For inputs and plain values it shows just the value.
- **`{{expr}}` inside other LaTeX** inserts the formatted value, for example `\frac{ {{stay}} }{ {{people}} }`.

### Calc blocks

` ```calc ` blocks are not shown to readers. The author's view can show them, with diagnostics.

**Inline shorthand** (`{{x = 100}}` in prose) is not in v1. It may come later as sugar for a definition placed at that point.

## 7. Rendering

1. **Plugin (`@vchernoy/remark-active`):**
   - collects the calc blocks and calls `parse`;
   - replaces directives with nodes carrying the binding;
   - marks `{{…}}` in math nodes;
   - reports diagnostics through vfile messages;
   - outputs: the tree, the `program`, and the binding manifest.
2. **Server or static render:**
   - calls `evaluate(program, defaults)`;
   - renders controls with their default values, views with computed values, and math with substituted values through KaTeX;
   - the page is complete without JavaScript.
3. **Runtime (`@vchernoy/active-runtime`):**
   - `mount(root, program, bindings, options)` creates a session and attaches to the controls;
   - on each change, `session.set(...)` updates only the views that changed, and re-renders only the KaTeX formulas whose values changed;
   - plain DOM, no framework.
4. **React (`@vchernoy/active-react`, for course-platform):**
   - an `<ActiveDocument>` wrapper, and a mapping from directives to MDX components;
   - it coexists with `remarkCalloutDirectives`.

**Rendering details:**

- **KaTeX:**
  - loaded only when a document has math;
  - MathML output by default (no CSS or fonts needed);
  - HTML output optional where the host ships KaTeX CSS, as course-platform already does;
  - always `trust: false`.
- **Accessibility:**
  - controls have labels;
  - result views use `aria-live="polite"`;
  - errors are announced as text, not only by color.
- **Locale:** for display and reader input, set by the host per document or per reader (open question §13).

## 8. Quizzes and tests (course-platform)

````markdown
```calc
input seed: int = 0              // set by the host per student and attempt
a = randomInt(seed, 2, 9)
b = randomInt(seed + 1, 2, 9)
```

Сколько будет {{a}} × {{b}}? :answer[a * b]{points=1 feedback="Умножьте {{a}} на {{b}}."}
````

- **`:answer[expr]`** renders an input box. The reader's entry is checked against `expr` with `checkAnswer` (exact match, or within `tolerance`).
- **The library reports** answer state and score through the runtime API: `onAnswer`, `results()`.
- **The host saves and restores** what students entered, and records scores. Reader values never go into the document.
- **v3** adds multiple choice (`:choice`), several answers per question, and units.

## 9. Trust levels and security

| | Untrusted (TypeBridge shared links, any author) | Trusted (course-platform authors) |
|---|---|---|
| Functions | Built-ins only | Built-ins plus functions registered by the host (pure, declared arity) |
| Components | Built-in controls and views | Plus components registered by the host (React through MDX) |
| HTML in Markdown | Off; output always goes through `rehype-sanitize` | The host decides (MDX is already trusted) |
| Network | Never; remote images load only after a click | The host decides |

**Always, at both levels:**

- no `eval` or `Function`;
- the calc language has no access to the DOM, storage or network;
- the limits in §4.10 apply;
- diagnostics never echo raw HTML.

## 10. Extensibility

- **`functions`:** a registry of pure functions `{ name, arity, types, impl }`. A name collision with a built-in is an error.
- **`components`:** a registry for new directive names, in the trusted level only.
- **`formats`:** named formatters, such as `currency:RUB` or `date:short`.
- **Language version:** `active: 1` in the frontmatter. New syntax arrives behind a version. Old documents keep working, and a newer feature in an older version is a clear error.

## 11. Repository and packages

One repository, **`vchernoy/active-md`**, with npm workspaces and one CI:

```
packages/calc      @vchernoy/calc            the language (no dependencies)
packages/remark    @vchernoy/remark-active   the remark plugin (unified, remark-directive, remark-math, remark-gfm)
packages/runtime   @vchernoy/active-runtime  the browser runtime (KaTeX loaded on demand)
packages/react     @vchernoy/active-react    React/MDX wrapper (later)
docs/              DESIGN.md (this file), LANGUAGE.md, EXAMPLES.md
```

- **Publishing:** to npm on version tags, with provenance. Both apps depend on exact versions, and local development uses `npm link`.
- **Splitting out `calc`** into its own repository later (`git subtree split`) only if it gains other users.

**TypeBridge** adds:

- `@vchernoy/calc`, `@vchernoy/remark-active` and `@vchernoy/active-runtime`;
- the unified stack, loaded only for Markdown documents;
- KaTeX, loaded only when a document has math.

This needs a maintainer decision under TypeBridge's AGENTS.md, recorded in the TypeBridge issue that integrates it.

## 12. Version plan

| Version | Contents |
|---|---|
| **v1** | Numbers, booleans and text; operators; `if`/`cond`; v1 built-ins; inputs with types, defaults, ranges and missing; single assignment; define-before-use; the three value states; `:input` (number, slider, select, checkbox); `:value`; `{{}}` in math, and formulas typeset automatically; server render and browser runtime; diagnostics; limits; deterministic random |
| **v2** | Lists, lambdas inside built-ins, `map`/`scan`/`fold`, generated tables, functions with clauses and patterns, `:answer` with scoring hooks, the React wrapper |
| **v3** | Charts from lists (our own SVG), matrix and finance built-ins, units, records, multiple-choice and multi-answer quizzes, opt-in recursion |
| **Not planned** | JavaScript, `eval`, network, mutation, symbolic algebra, computing from LaTeX |

## 13. Open questions

1. **Locale:** do number display and input follow the document (`lang` in the frontmatter) or the reader's browser? Proposal: the document sets it, and the host can override.
2. **Units in v3:** a typed units system (`5 km / 2 h = 2.5 km/h`), or only display suffixes?
3. **Should the author's view show calc blocks inline,** or in a side panel?
4. **Table syntax:** is a template row with `for=` enough, or do we also want `columns=`?
5. **TypeBridge transliteration:** prose is converted, but calc blocks, directive names, `{{…}}` and math are skipped. The exact token rules live in TypeBridge, not here.
6. **License** for `active-md`. Proposal: MIT.

## 14. Example: the compound-interest lesson (replacing the hand-written component)

````markdown
```calc
input principal: number = 100000 in 0..100000000
input rate: number = 8 in 0..100        // % per year
input years: int = 10 in 1..50
growth = (1 + rate / 100) ^ years
final = principal * growth
interest = final - principal
```

Вложив :input[principal]{format=currency} под :input[rate]{widget=slider step=0.5} % на :input[years] лет,
вы получите **:value[final]{format=currency}**, из них проценты — :value[interest]{format=currency}.

$$ {{final}} $$
````
