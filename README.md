# active-md

Markdown + LaTeX with **live calculations and form controls**: inputs the reader can change, results that update, and formulas typeset with current values. For courses, it adds questions whose answers are checked.

It's built for authors writing prose, and it's safe for documents that anyone may have written: no JavaScript in documents, no `eval`, no network.

**Status:** design stage. See [docs/DESIGN.md](docs/DESIGN.md), especially §0 (Version 0).

## Example (v0)

````markdown
```calc
input principal = 100000 in 0..100000000
input rate = 8 in 0..100        // % per year
input years = 10 in 1..50
final = principal * (1 + rate / 100) ^ years
```

Investing :input[principal] at :input[rate]{widget=slider step=0.5} % for :input[years] years
gives **:value[final]{format=fixed:0}**.

$$ P_n = {{principal}} \cdot (1 + {{rate}}/100)^{ {{years}} } = {{round(final)}} $$
````

## Packages (planned)

| Package | What it is |
|---|---|
| `@vchernoy/calc` | The calc language: parse, evaluate, sessions. Pure TypeScript, no dependencies, no DOM. |
| `@vchernoy/remark-active` | A remark plugin: calc blocks, `:input`, `:value`, `{{…}}` in math |
| `@vchernoy/active-runtime` | A browser runtime that makes the rendered page live |
| `@vchernoy/active-react` | A React/MDX wrapper (later) |

## Planned integrations

Neither integration exists yet; both are tracked in #1.

- [TypeBridge](https://github.com/vchernoy/typebridge): the Markdown document format and shareable pages
- [course-platform](https://github.com/vchernoy/course-platform): websites, blogs, lessons and tests

## License

MIT
