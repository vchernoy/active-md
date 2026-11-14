# active-md

Markdown + LaTeX with **live calculations and form controls**: inputs the reader can change, results that update, and formulas typeset with current values. For courses, it adds questions whose answers are checked.

It's built for authors writing prose, and it's safe for documents that anyone may have written: no JavaScript in documents, no `eval`, no network.

**Status:** v0 in progress. Try it in the **[playground](https://vchernoy.xyz/active-md/)**: one editor, one Edit/View switch, share links that keep the document in the URL. See [docs/DESIGN.md](docs/DESIGN.md), especially §0 (Version 0).

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

## Packages

| Package | What it is |
|---|---|
| `@vchernoy/calc` | The calc language: parse, evaluate, sessions. Pure TypeScript, no dependencies, no DOM. |
| `@vchernoy/remark-active` | A remark plugin: calc blocks, `:input`, `:value`, `{{…}}` in math |
| `@vchernoy/active-runtime` | A browser runtime that makes the rendered page live |
| `@vchernoy/active-react` | A React/MDX wrapper (later) |

`apps/playground` is the GitHub Pages app: `npm run dev -w apps/playground`.

### Install (once 0.1.0 is published)

```sh
npm install @vchernoy/remark-active @vchernoy/active-runtime
```

```ts
import { renderActive } from '@vchernoy/remark-active';
import { mount } from '@vchernoy/active-runtime';

container.innerHTML = renderActive(markdown).html; // sanitized, default values filled in
mount(container);                                   // make it live
```

### Releasing

All packages share one version. Set it in each `packages/*/package.json` (and the internal dependencies), update `CHANGELOG.md`, run `npm run build && npm run release:check`, merge, then push a tag: `git tag v0.1.0 && git push origin v0.1.0`. The `release` workflow tests, checks and publishes to npm with provenance. It needs the `NPM_TOKEN` repository secret: an npm token that can publish `@vchernoy/*`.

## Planned integrations

Neither integration exists yet; both are tracked in #1.

- [TypeBridge](https://github.com/vchernoy/typebridge): the Markdown document format and shareable pages
- [course-platform](https://github.com/vchernoy/course-platform): websites, blogs, lessons and tests

## License

MIT
