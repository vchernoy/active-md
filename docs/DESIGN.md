# active-md: design

Status: **design intent**. §0 describes the original subset; the 0.2 conditions below are implemented in 0.2. Later-version sections remain proposals.
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
  - `{{expr}}` inside math (unchanged numeric TeX), or `{{expr | spec}}` for the same locale-aware formats as `:value` (`auto`, `int`, `fixed:N`, `percent:N`). A single `|` separates the expression and format; pipes are not calc operators. Formatted separators and TeX special characters are escaped before KaTeX sees them; invalid formats produce a red `?` and a positioned diagnostic. Server defaults and live updates share this substitution path.
- **Not in v0:**
  - functions;
  - lists and tables generated from them;
  - `missing`;
  - `if`/`cond`;
  - quizzes;
  - text, bool and select inputs;
  - automatic typesetting of a formula's definition (`$$ {{name}} $$`), so `{{…}}` in math always inserts a value.

### 0.2 Conditions (Refs #31)

Calc remains numeric: comparisons `== != < <= > >=` and logic return 1/0, with zero false and every nonzero finite number true. Arithmetic binds first, then comparisons, `not`, `and`, `or`. Comparisons cannot be chained without explicit grouping. Equality is exact; write `abs(a-b) < 1e-9` for tolerance. `and`/`or` short-circuit. Reserved `if(c1, a, c2, b, …, otherwise)` takes an odd argument count of at least three, tests conditions in order and evaluates only the selected value. Every branch is still parsed and name-checked. `even(x)` and `odd(x)` test `round(x)` correctly for negative numbers; `%` retains JavaScript semantics (`-3 % 2` is -1). New expression nodes use the existing depth and step budgets; skipped branches consume no evaluation steps.

`:::when[expr]` conditionally shows sanitized content; only proven-false blocks are omitted. See §6 for nesting, control analysis and diagnostics. Missing inputs remain future work: when they exist, a missing condition will mean false, without an error.

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
6. **Conditional content does not scope definitions.** Calc blocks inside `when` are errors: the global program always exists. Hidden controls keep their last value; explicitly gate their contribution with `if(useExtra, extra, 0)`.
7. **Control reachability is checked statically.** Through all transitive definitions and enclosing conditions, an input that can hide every one of its controls is an error. A control outside the gating block makes it valid. Cross-block cycles are warnings; the check does not prove conditions satisfiable.
8. **No zero-parameter functions.** Write `y = …`, not `y() = …`. Values are already live, so the two would mean the same thing.

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

### 4.5 Numeric conditionals (0.2; later typed conditions remain proposed)

Only the chosen branch is evaluated:

```calc
fee = if(total > 10000, 0, 300)
sign = if(x < 0, -1, x > 0, 1, 0)
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

Implemented in 0.3 (Refs #41): `ln(x)` is natural log; `log(x)` is base-10 log and `log(x, base)` selects a base. Arguments must be positive; a log base must be positive and not 1. `exp(x)` computes e^x. `sin`, `cos`, `tan`, `asin`, `acos`, `atan` and `atan2(y, x)` use radians; `asin`/`acos` require inputs in [-1, 1]. `deg(radians)` and `rad(degrees)` convert units. Nonfinite results (including overflow) are positioned error values, never NaN or Infinity. Each call consumes the existing one call-node step plus its evaluated argument nodes; no budget changes.

`pi` and `e` are built-in constant names. A document's own value or input definition shadows the corresponding constant with a positioned warning at the definition name. Shadowed names keep ordinary define-before-use/self-reference rules and dependency updates; constants without a document definition are available in model expressions and reader bindings.

The following v1–v3 entries are proposals unless already described above:

- **v1:**
  - `round(x, digits=0)`, `floor`, `ceil`, `abs`;
  - `min(...)`, `max(...)`, `sqrt`, `pow`;
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
| Conditional block nesting | 8 |
| Calc source size | 64 KB |
| Definitions | 2,000 |
| Steps per full evaluation (`maxSteps`) | 1,000,000 |
| List length | 10,000 |
| Rows in a generated table | 1,000 |
| Recursion depth (v3) | 256 |

Going over a limit is an **error** in the affected name. It never freezes the page.

### Expression preparation (#45)

After full source validation and dependency analysis, calc prepares definitions in document
order and prepares compiled document expressions (conditions, value bindings and math
placeholders) using the same pass. Immutable successful constants propagate transitively;
input defaults never become constants. Closed successful arithmetic, comparisons, logic
and deterministic built-ins fold using the existing evaluator. Constant subexpressions
also fold inside live expressions; no reassociation or identities such as `x * 0` are used.

A declared input range is enforced by both session setters and whole-program overrides.
Preparation can prove direct comparisons of that range (or an immutable alias) with a
constant, including inclusive endpoints. A narrower UI control range is not a model proof.
Unbounded inputs and inconclusive comparisons stay live; interval arithmetic for derived
arithmetic expressions is deliberately not attempted.

Only leading proven lazy decisions discard operands: false `and`, true `or`, and leading
constant `if` conditions. Boolean results remain numeric 0/1. Live dependencies describe
the remaining expression; original expressions and their source spans remain available
for diagnostics. Validation still rejects invalid names/calls in unreachable source.
Domain errors are not folded into values, and evaluation order is unchanged.

Preparation has a bounded shared work budget and falls back to source if exhausted.
Folded nodes retain their original evaluation step charges. Evaluation falls back to the
original expression when a restrictive remaining budget or failed referenced name could
make the optimized path observably different; sessions use the original dependency graph
when a host budget could affect definition results. This keeps step-limit and dependency
errors intact, including their source positions.

`CompiledExpression.constant`, when present, identifies a successful value proven for
all supported input values, rather than the authored default. Rendered conditions expose
this as `data-active-when-constant`; browser sessions independently prepare the same source
with their own limits and do not trust serialized ASTs or proof attributes. A condition
proven false is omitted with its entire subtree before HTML serialization
(#46), including subtree-only controls, value/math bindings, nested conditions and error
placeholders. This is a semantic simplification, not an authorization boundary: source
and the global calc program remain available. True blocks retain their content and live
nested expressions. Initially false conditions that can change with supported inputs
stay in the HTML with `hidden` and become visible on input changes. Errors, unknowns and
step-budget failures are not false proofs. Original structural/source validation runs
before omission; skipped subtree evaluation errors stay lazy and unreported.

### 4.11 Determinism

- No clock and no `Math.random`: the same program and inputs give the same values within a JavaScript engine.
- Transcendental functions use JavaScript Math approximations. Node/V8, Firefox and Safari may differ in the last bit. Displayed formatted values normally agree, but values near rounding boundaries can differ; exact `==` is not a portable tolerance comparison. Prefer `abs(a - b) < 1e-9` when comparing approximate results. This does not weaken the language's exact equality semantics.
- Implemented seeded calc draws (unreleased, #48 prerequisite): `rand(seed[, draw])` returns a value in `[0, 1)`; `randInt(seed, min, max[, draw])` returns an integer in inclusive bounds. `seed` and optional `draw` are integers in `0..4294967295`; `draw` defaults to zero. Bounds are safe integers, min <= max, spanning at most 2^32 integers. Invalid arguments report positioned errors. Distinct draw counters give reproducible draws without mutable state (not a guarantee of different outputs).
- Seeded algorithm v1 applies MurmurHash3 fmix32 to `(seed + imul(draw, 0x9e3779b9)) mod 2^32` and divides the unsigned word by 2^32. Integer draws map with `min + floor(rand * (max-min+1))`. This is a discrete, deterministic educational generator, not cryptography or authoritative grading. Future snapshot compatibility must include algorithm identity if the algorithm changes.
- Inputs used as seeds remain live dependencies through ordinary session setters and simplification; literal seeds may fold. Calc draws no entropy. Runtime-owned quiz seeds, attempt initialization/retry and question/answer UI are still unimplemented #48 work.

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

Callout labels and `details` summaries preserve Markdown phrasing: emphasis, code and
inline `$…$` math use the same sanitized rendering path as paragraph content. Calc
`{{…}}` placeholders inside title math update through the ordinary runtime bindings;
titles inside hidden `when` blocks retain the same lazy evaluation rules. Unlabelled
containers keep their existing default titles.

### Conditional containers (0.2)

Prefer one condition, such as `:::when[rate > 0 and years > 5]`, over two nested `when` blocks when both conditions gate the same content. A callout or `details` directly inside a `when` needs only one extra colon on the outer `when` (`::::when` around `:::note`); only a `when` inside another `when` adds another conditional level. Increase outer fences for each container level, including callouts/details.

Outer fences may be longer than required. Start with five or six colons (`::::::when[…]` … `::::::`) to leave room for adding inner containers later. See [the generous-fence example](../examples/generous-fences.md). A paragraph consisting only of three or more colons produces a positioned warning naming the nearby container that may have closed early and suggesting a longer outer fence or combining conditions with `and`. Code spans and fenced code remain literal; warnings do not repair fences or remove source content.


```markdown
::::when[x != 0]
The reciprocal is :value[1/x].
:::when[x < 0]
…and x is negative.
:::
::::
```

- Any calc expression is allowed, including built-in calls and comparisons. Nonzero shows the block. A condition proven always zero is omitted before serialization; an initially zero live condition retains its wrapper and content with `hidden`. This is visibility, **not secrecy**: source and the global calc program remain available, and live hidden content remains in HTML.
- A nested block is visible only if all enclosing conditions are true. Conditions, value bindings and math in a hidden subtree are never evaluated, and their errors are not reported to the reader or announced. On becoming visible, bindings refresh to current inputs. A failing visible condition hides its block and reports a positioned error outside that block. Visibility changes do not programmatically move focus or use a live region.
- Use longer fences around nested containers. More than eight levels is a positioned structural error even in hidden content.
- A calc block anywhere inside `when` is excluded and reports: "calc blocks can't be inside :::when; definitions are global, use if()". Declare inputs and definitions outside all conditional containers.
- Controls are views of global inputs. Hiding a control never resets its value. A hidden extra amount still affects an ungated global formula; use `total = base + if(useExtra, extra, 0)` to opt out.
- A self-hiding input (directly, through definitions, or through enclosing conditions) produces a positioned error if all its valid controls lie inside the gating block. Add an outside control. Cross-block control cycles produce warnings, not errors; no satisfiability solver is involved.
- Static control analysis caches definition/expression closures and uses the host `maxSteps` budget. Exhaustion is a positioned error. With no controls or gated controls, dependency expansion is skipped.
- There is no `:::else`: use an independent `:::when[not (condition)]`. Independent blocks can overlap. `choose`/`otherwise` and quiz feedback slots are deferred. Future missing conditions will count as false without an error; missing inputs are not implemented yet.

### Inside math

- **`{{name}}` on its own inside `$$…$$`** typesets that name's definition as LaTeX, with its value: `name = …formula… = value`. For inputs and plain values it shows just the value.
- **`{{expr}}` inside other LaTeX** inserts the formatted value, for example `\frac{ {{stay}} }{ {{people}} }`.

Negative or compound numeric math substitutions (scientific notation or formatted grouping)
get visible `\left(…\right)` parentheses when immediately followed by `^` or immediately
after a binary `\cdot`, `\times`, `\div`, `+`, `-`, `*` or `/`. Plain positive numbers
are unchanged; an equality, unary sign or TeX argument alone does not request parentheses.
Authored parentheses remain untouched. Every substituted value still forms one TeX group
for commands/exponents. Text-mode commands such as `\text`/`\emph`/`\operatorname`, boxed labels (`\fbox`,
`\colorbox`, `\fcolorbox`, including preceding color arguments), and verbatim
labels keep numeric text without injected math delimiters. This is conservative display
context handling, not symbolic algebra or a general TeX parser (#30, unreleased).
For other macros that enter text mode only during expansion, generated grouping uses
KaTeX’s built-in `\TextOrMath` to select unchanged numeric text versus mathematical
parentheses at parse time. JavaScript does not expand document macros; KaTeX’s existing
expansion limit still applies.

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

Runtime initial input restoration (#54, unreleased): `mount` accepts a host-supplied
`initialInputs` numeric map. It validates declared model inputs plus all authored control
bounds before the first refresh; accepted entries override browser-restored controls.
Unknown/nonfinite/incompatible entries are skipped. Model-only inputs participate, and
there are no host subscription callbacks during this initial batch. The host stages the
container and awaits `settled()` before revealing asynchronous math or starting persistent
subscriptions. `resetInputs()` uses the original authored defaults in one model reset and
clears stale control validation. No startup initializer/event API or input storage is
implemented; any future initializer contract must preserve accepted restored inputs.

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

### Numeric answer checking (implemented helper, unreleased #48 prerequisite)

`checkAnswer(expected, given, { tolerance = 0, relative = false })` is a pure exported
calc API, not a calc-language function or quiz UI. Hosts separately evaluate expected
expressions and parse responses. It returns `{ kind: 'checked', correct: boolean }`,
or `{ kind: 'invalid', field, message }` for a nonfinite expected/response, invalid
tolerance or nonboolean relative option. Invalid data never silently grades incorrect.
Unanswered responses and answer parsing remain the host/future quiz layer's concern.

Zero tolerance uses exact numeric equality (including +0/-0). Positive absolute tolerance
accepts `abs(given - expected) <= tolerance`. Relative tolerance accepts an error ratio
against `abs(expected)` within tolerance, with inclusive boundaries; expected zero
accepts only zero. It uses floating-point arithmetic with overflow-safe normalization,
without an implicit epsilon or absolute fallback. Tolerance must be finite/nonnegative.
This helper does not draw randomness, assign points, persist answers, initialize seeds,
freeze attempts or provide authoritative grading. The quiz syntax below remains proposed.

### Quiz authoring validation (#48 prerequisites)

Before evaluating or pruning `when`, the plugin validates question/submit source order.
Each `::quiz-submit` closes all preceding `:::question` containers since the previous
submit. Empty groups and trailing unsubmitted questions have positioned diagnostics.
Questions and submits must have exactly the same enclosing `when` nodes; each answer
or choice must share its question's conditional context. Complete hidden groups stay
independent, and conditional explanatory content is allowed. Questions cannot nest;
submits belong outside questions; `:answer` and `::choice` belong inside questions.
This pass is iterative and linear in tree size and does not evaluate quiz expressions.

The additional type/control-count validation is unreleased.
Question containers require explicit `type=number`, `type=single` or `type=multiple`.
Numeric questions require exactly one correctly formed `:answer` and no `::choice`;
single/multiple questions require at least one `::choice` and no `:answer`. These
checks also run before visibility pruning, report at the question source position,
and do not count controls inside nested invalid questions toward their parent.

Expected `:answer` expressions are compiled through the bounded calc session before
visibility pruning, using their exact source labels (including multiplication syntax).
Compile diagnostics retain the answer directive's position, including blockquotes.
This does not evaluate or grade input-dependent expected answers. Answer `tolerance`,
when supplied, must be a nonempty finite nonnegative numeric literal. `relative` is a
boolean flag: bare/true enables relative mode; false disables it. Invalid attributes
are diagnosed at the answer before pruning, matching the pure `checkAnswer` contract.
Omitted options retain its defaults (zero absolute tolerance); grading remains deferred.

Optional `quiz-submit` seed bindings must name a declared calc input. Independent
groups must use distinct seed inputs, and a bound seed cannot have a reader-editable
`:input` control, including controls in hidden branches. Errors retain submit/control
source positions. This validation does not initialize or change seeds.

Single-choice questions must mark at least one choice accepted. `::choice[...]{correct}`
or `{correct=true}` marks an accepted choice; `{correct=false}` does not. Other
correct-flag values are diagnosed at the choice position before visibility pruning.
Single selection may have several accepted choices (any one earns credit in the
planned runtime); multiple selection will require the exact accepted set, which may be empty. This pass
validates authoring only and does not grade responses.

This is authoring validation only: points, rendering, grading and attempt state
are still unimplemented. Valid quiz
directives continue to render as literal source until that integration ships; no quiz
manifest or snapshot API is exported by this prerequisite.

## 8. Quizzes and tests (course-platform)

The runtime below is design intent tracked in #48, not implemented UI or APIs.
The source-order/conditional validation prerequisite above is implemented.

````markdown
```calc
input quizSeed = 1
a = randInt(quizSeed, 2, 9)
b = randInt(quizSeed, 2, 9, 1)
```

:::question{type=number}
Сколько будет {{a}} × {{b}}?

:answer[a * b]{tolerance=0}
:::

::quiz-submit[Check]{seed=quizSeed}
````

- Each submit groups preceding questions. Planned answer modes are numeric checks
  (optional tolerance), single choice (any accepted choice) and multiple choice
  (exact accepted set), with points defaulting to one.
- Draft answers reveal no correctness. Check freezes answers, the variant and score;
  Retry starts a fresh attempt only for that group. Optional seed bindings initialize
  a runtime-owned declared calc input on first attempt and Retry, never on Check.
- The future runtime exposes attempt/results state for hosts. No such snapshot/event
  API is implemented yet. Hosts own persistence, progress and authoritative grading.
- Numeric `checkAnswer` and seeded calc draws are implemented prerequisites; grouping
  validation checks question types/control counts, and compiles answer expressions, and validates seed bindings, and validates accepted-choice flags, but not points.

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

The concrete API proposal is in [EXTENSIONS.md](EXTENSIONS.md) (#9).

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

Optional runtime styles size ranged number controls at mount from min/max, starting value and step precision (3–12 characters, including spare space); unbounded controls keep 8. Width hints are runtime DOM styles, not sanitized renderer output.

The optional `@vchernoy/active-runtime/style.css` also sets `.active-doc math` to prefer locally installed "STIX Two Math", "Cambria Math", then "Latin Modern Math", with generic `math` fallback. It includes no font files and makes no font requests. MathML remains renderable with native browser defaults when consumers omit this optional stylesheet.

Optional runtime styles provide scoped callout borders, 8% tinted backgrounds and bold coloured titles. Consumers can override `--active-callout-note`, `--active-callout-tip`, `--active-callout-warning`, `--active-callout-danger`, `--active-callout-important` and `--active-callout-exercise` on `.active-doc`. Defaults follow the system colour scheme; root `data-theme="light"` or `"dark"` takes precedence. The playground consumes these defaults without a separate callout palette. Details remain fold-outs with consumer-defined neutral styling.

Runtime control validation shows a polite live message associated through
`aria-describedby`. Invalid text leaves the accepted model unchanged; the message
explicitly says results use the last accepted value. Correction, accepted peer updates
and reset clear the message. Destroy removes runtime-owned messages and descriptions.

### Playground reader state (#8)

Accepted numeric inputs (including model-only inputs) stay in memory across Edit/View
remounts while source is unchanged. Reset values restores authored defaults and clears
validation. Editing source or loading Example discards reader state; reload starts from
authored defaults. Reader values never rewrite source, enter localStorage or travel in
share links. The share UI explicitly describes authored-default semantics.

The playground shows a horizontal-scroll hint when display math exceeds its viewport.
Overflowing formulas get keyboard focus and an associated description; narrow formulas
do not add tab stops. Resize, live rendering and font loading refresh the cue, and
mode changes disconnect its observers. This is a host affordance, not serialized output.

The playground sample gives compound-interest controls explicit labels with units.
Labeled controls in prose remain inline on desktop and use compact aligned rows at
560px and narrower; number widths remain bounded and slider readouts stay in the row.
This host CSS does not change the renderer or saved reader state.

### Named prose colors (#9, unreleased)

`:mark[important text]{color=red}` wraps inline Markdown in a sanitized span.
The required color is exactly red, green, blue, orange, purple or gray; other
attributes and CSS color values are rejected with positioned diagnostics.
Emphasis, code, safe links and inline math retain their normal rendering.
The optional runtime stylesheet maps these names to light/dark theme tokens
`--active-mark-<name>` on `.active-doc`, following system preference unless root
`data-theme` explicitly selects light/dark. Hosts may override tokens in their CSS;
documents cannot provide CSS. Without the stylesheet, the text remains readable
with the host's ordinary text color. Extension registries remain deferred.
