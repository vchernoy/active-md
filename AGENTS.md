# Working on active-md

Read [docs/DESIGN.md](docs/DESIGN.md) before making changes. Treat it as design intent, not proof that a feature exists. §0 defines Version 0.

## Hard rules

- **Safe for untrusted documents:**
  - no `eval`, `new Function` or dynamic code from document content;
  - no network calls, telemetry or third-party scripts;
  - every computation is bounded by the limits in DESIGN §4.10;
  - rendered output is sanitized for untrusted documents.
- **`@vchernoy/calc` stays pure:** no dependencies, no DOM, no Markdown, no LaTeX rendering. It must run in Node and in browsers.
- **The calc language is single assignment and define-before-use** (DESIGN §3). Don't add mutation, loops with reassignment or side effects.
- **Determinism:** no clock and no `Math.random` in evaluation. The same program and inputs give the same values.
- **Never log document text** or reader input.

## Practice

- TypeScript and ESM. Small, reviewable changes; one PR per issue.
- Add meaningful Vitest coverage for every behavior you change. Parser and evaluator changes need tests for errors and source positions, not only for the success path.
- Before pushing, run lint, typecheck, tests and build once the scaffold exists.
- Keep `docs/` current: update DESIGN.md when behavior or syntax changes.
- Don't claim releases, npm publishing or consumer integration before they exist.

## Process

Follow TypeBridge's [CONTRIBUTING.md](https://github.com/vchernoy/typebridge/blob/main/CONTRIBUTING.md) for this repository too:

- issues first;
- independent review, with severities P0–P3;
- CI green before merge;
- squash merges.

Never merge a pull request unless the maintainer explicitly asks you to merge that PR.
