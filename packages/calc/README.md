# @vchernoy/calc

The calc language of [active-md](../../README.md): parse calc blocks, evaluate them, and keep a live session as inputs change. Pure TypeScript, no dependencies, no DOM, no `eval`.

```ts
import { parse, createSession, formatNumber } from '@vchernoy/calc';

const program = parse([{ id: 'calc-1', text: `
input rate = 8 in 0..100   // % per year
input years = 10 in 1..50
growth = (1 + rate / 100) ^ years
` }]);

program.diagnostics;              // errors and warnings, with spans
const s = createSession(program);
s.subscribe(changed => { /* re-render bindings that use these names */ });
s.set('years', 20);               // undefined, or an error message if rejected
const r = s.get('growth');        // { kind: 'value', value: 4.66… } or { kind: 'error', message }
formatNumber(r.kind === 'value' ? r.value : NaN, { kind: 'fixed', digits: 2 });
s.compile('round(growth, 2)').evaluate();   // for :value[…] and {{…}} bindings
```

v0 language: `input name = number [in min..max]`, `name = expression`; numbers, `+ - * / % ^`, unary minus, parentheses; `round(x[, digits])`, `min`, `max`, `abs`, `floor`, `ceil`, `sqrt`. Each name is defined once, and an expression uses only names defined above it. See [docs/DESIGN.md](../../docs/DESIGN.md) §0.

## Choice self-check API (unreleased)

`checkChoiceAnswer(choices, givenIds, 'single' | 'multiple')` checks stable string
identities independently of display order. Each choice has `{ id, correct }` with a
boolean flag. Single mode accepts any one correct choice; multiple mode requires
the exact correct set, including empty. Malformed, duplicate or unknown IDs return
`{ kind: 'invalid', field, message }`; valid submissions return
`{ kind: 'checked', correct }`. Arrays are bounded to 2000 entries and 65536 cumulative
ID code units per array. It is a pure host API, not a calc-language function or quiz
UI/attempt/scoring integration.
