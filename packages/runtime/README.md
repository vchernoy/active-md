# @vchernoy/active-runtime

Makes a document rendered by [`@vchernoy/remark-active`](../remark/README.md) live in the browser. Plain DOM, no framework.

```ts
import { renderActive } from '@vchernoy/remark-active';   // on the server, or in the browser
import { mount } from '@vchernoy/active-runtime';
import '@vchernoy/active-runtime/style.css'; // optional theme-neutral control/math layout

container.innerHTML = renderActive(markdown, { locale }).html;
const live = mount(container, { locale });   // later: live.destroy()
```

- Reads the calc program from `data-active-calc` on `.active-doc` and starts a session.
- `input[data-active-input]` and `select[data-active-input]` controls set inputs; several controls of one input stay in sync (the one being edited is never rewritten); values outside the input's range are rejected (`aria-invalid`, a `title` and the browser's validation message), and nothing changes.
- `[data-active-value]` views and `[data-active-tex]` formulas are redrawn only when a value they use changes. KaTeX is loaded on the first formula update (`loadKatex` to supply it yourself).
- Values the browser restored into controls (back/forward, autofill) are adopted on mount.
- Use the same `locale` (and math `output`) as the renderer so updated text matches the first render.

The optional stylesheet is scoped to `.active-doc`, sizes number/range controls, marks invalid inputs with the current text color, and honors KaTeX MathML column alignment. Override `--active-input-ch` (default `8`) to choose a number input width. Load this stylesheet with the renderer in lazy integrations; importing the runtime JavaScript does not load CSS automatically. It adds no fonts, requests or theme palette.


## Restoring reader inputs (0.5.0)

Pass `initialInputs: new Map([['x', 5]])` to `mount`. The runtime iterates declared
inputs (including model-only inputs), accepts finite numeric values through the model
validator, and also checks every authored control's min/max bounds. Unknown names,
definitions, invalid values and out-of-range entries are skipped individually. Accepted
values are installed before the first runtime refresh, with no host subscription events
for the initial batch. Source and authored defaults are unchanged.

Accepted entries win over browser-restored/autofilled controls, even when equal to the
authored default. Skipped entries retain normal browser restoration behavior. Slider
steps keep their existing nearest-position behavior; the model/readout retains the
accepted number. Public session setters now synchronize peer controls as well as views;
the control actively being edited is not rewritten under the cursor. Model setters still
validate model ranges; hosts restoring state should use `initialInputs` to additionally
validate all authored control bounds.

For asynchronous restore, keep the rendered container hidden/staged, load saved values,
call `mount(container, { initialInputs })`, then `await live.settled()` before revealing
it so math and conditional visibility agree. Subscribe for persistence only after mount
and restoration settle. The runtime stores no inputs and schedules no startup events;
this API does not introduce quizzes, event initializers, or a persistence layer.

`live.resetInputs()` returns every input to its authored default as one model reset,
synchronizes controls and clears unfinished invalid control text even when the model
already equals defaults. Await `live.settled()` for math updates. Reset does nothing after
`destroy()`. Hosts own storage deletion/reset policy and lifecycle cancellation.

## Quiz metadata inspection (0.6.0)

`inspectQuizManifest(value)` validates unknown object data against the bounded v1
compiler metadata schema and copies only known fields into an independent manifest.
It returns `{ kind: 'valid', manifest }` or an invalid `reason` (`malformed`, `version`,
`too-large`). Empty documents are valid; malformed/oversized groups and ambiguous
identities are rejected atomically. It does not parse JSON, compile expressions,
prove source/session compatibility, sanitize label Markdown into HTML, mount quizzes,
initialize seeds or persist answers. Existing `mount()` behavior is unchanged.

`compileQuizManifest(value, session)` prepares inspected quiz metadata against a trusted
calc session, returning `kind: 'compiled'` with independent `manifest`, group-ID
`conditions` and numeric-question-ID `answers` maps, or an all-or-nothing invalid result.
It checks declared seed inputs and expression diagnostics without evaluating answers,
changing inputs or mounting controls. Expressions stay bound to the supplied session.
This helper does not prove source/DOM provenance or enable quiz attempts.

`checkQuizGroup(prepared, groupId, responses)` checks one prepared visible group using
host-parsed numeric responses or choice-ID arrays. It returns `hidden`, `invalid`, or
`checked` with detached weighted result rows. It applies current session conditions and
expected answers without changing inputs or enabling quiz UI. This self-check
helper does not manage attempts, Retry, persistence or authoritative grading.


## Numeric selects (0.6.0)

Readable edit/slider controls use the same runtime paths as legacy number/range
controls. Selects use native change events and share the same numeric binding and
reset API. The mounted session rejects values absent from its select option domains,
including public setters and numeric peer edits. Initial restored values must fit
all controls; a removed option retains the authored default. Pure calc sessions do
not acquire widget domains. Source/defaults are never rewritten. Group/option labels
are visible, unlike edit/slider bracket names. Optional CSS bounds long dropdowns
and wraps group labels. Radio/checkbox/button controls and complete quiz UI are not
provided by these APIs.
