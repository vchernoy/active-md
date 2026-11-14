# Extensions (proposal)

**Status: proposal for #9. Nothing here is implemented yet.** It turns the boundaries agreed in #9 into concrete APIs, so hosts such as course-platform can add their own directives, controls, functions and formats without changing active-md.

## 1. Principles

1. **Documents are text; extensions are host code.** A document only names an extension (`::video{asset=intro}`). The code that renders it is TypeScript registered by the host at startup. A document can never bring code with it.
2. **One extension, two halves.** Rendering (Markdown → HTML or MDX, on the server or in the browser) and behavior (making it live in the browser) are separate entry points. A static page loads only the first. An extension package can export both from separate modules.
3. **Core uses the same API.** Built-in `:input` and `:value`, and later the quiz, are written as extensions over the same registries. If the API is good enough for core, it's good enough for hosts.
4. **Trust decides what runs.** The untrusted level (TypeBridge share links) allows only built-ins and extensions marked `untrusted: true`, and their output is always sanitized. The trusted level (course-platform) allows anything the host registers.
5. **Calc stays pure.** Extensions can read and set values through a session, but nothing gives the calc language access to the DOM, storage or network.

## 2. The extension object

An extension has three parts. Each part goes to the side that needs it:

| Part | Contains | Used by |
|---|---|---|
| **Calc** (`defineCalc`, in `@vchernoy/calc`) | `functions`, `formats` | **both** the renderer and the runtime, since server-rendered values and live updates must use the same implementations |
| **Render** (`defineExtension`, in `@vchernoy/remark-active`) | `directives`, plus the calc part | the renderer (server or browser) |
| **Behavior** (`defineBehavior`, in `@vchernoy/active-runtime`) | `controls`, plus the calc part | the runtime in the browser |

```ts
// course-calc.ts: pure code, safe to import on both sides
import { defineCalc } from '@vchernoy/calc';
export const courseCalc = defineCalc({
  name: 'course',
  untrusted: false,                // may it run at the untrusted level? (default false)
  functions: [/* FunctionSpec */], // e.g. pmt(rate, n, pv)
  formats: [/* FormatSpec */],     // e.g. currency:RUB
});

// course-render.ts
import { defineExtension } from '@vchernoy/remark-active';
export const course = defineExtension({ name: 'course', calc: courseCalc, directives: [/* DirectiveSpec */] });

// course-behavior.ts: a separate module, so static pages don't load it
import { defineBehavior } from '@vchernoy/active-runtime';
export const courseBehavior = defineBehavior({ name: 'course', calc: courseCalc, controls: [/* ControlSpec */] });
```

Hosts pass the render part where they render, and the behavior part where they mount:

```ts
renderActive(markdown, { trust: 'trusted', extensions: [course] });
mount(root, { trust: 'trusted', behaviors: [courseBehavior], onEvent });
// React hosts: <ActiveDocument trust="trusted" calc={[courseCalc]} components={{ video: VideoPlayer }} onEvent={…}>
```

- **No code goes into the document.** The rendered HTML names what it uses: `data-active-calc` keeps the calc source text, and the root carries `data-active-uses="course"`. The runtime gets the implementations only from what the host passes to `mount`.
- **The same rules apply on both sides.** `mount` rebuilds the session with the calc parts from its `behaviors`, filtered by its own `trust` exactly as the renderer filters by its `trust`. So `parse`, `evaluate`, `compile` and `format` resolve the same names on both sides.
- **A mismatch is visible, never silent.** If the page uses an extension that `mount` wasn't given (or the trust levels differ), the affected values show an error ("unknown function pmt") and `mount` reports it through `onEvent({ type: 'error', … })`. The server-rendered text stays as it was.

A name that collides with a built-in or with another extension is an error at registration, not in a document.

## 3. Directives (rendering)

```ts
type DirectiveSpec = {
  name: string;                              // :name, ::name or :::name
  kind: 'text' | 'leaf' | 'container';
  label?: 'none' | 'text' | 'expr' | 'name'; // how [label] is read: ignored, Markdown text, a calc expression, an input name
  attributes?: Record<string, AttrSpec>;     // validated before render; unknown attributes are an error
  render(node: DirectiveNode, ctx: RenderContext): RenderOutput;
};

type AttrSpec =
  | { type: 'string'; required?: boolean; default?: string; pattern?: RegExp }
  | { type: 'number'; required?: boolean; default?: number; min?: number; max?: number }
  | { type: 'boolean'; default?: boolean }
  | { type: 'enum'; values: readonly string[]; default?: string }
  | { type: 'expr' };                        // compiled against the program; errors reported with positions

type RenderContext = {
  trust: 'untrusted' | 'trusted';
  locale?: string;
  program: Program;
  session: Session;                          // evaluated with defaults, for server-rendered values
  compile(expr: string): CompiledExpression;
  format(value: number, spec?: string): string;
  report(message: string, severity?: 'error' | 'warning'): void; // positioned at this directive
  id(): string;                              // stable id (see §7)
};

type RenderOutput =
  | { hast: ElementContent | ElementContent[] }          // HTML hosts
  | { jsx: string; props: Record<string, unknown> }      // MDX hosts: becomes <Name {...props}/>
  | { error: string };                                   // shown inline as ⚠, and reported
```

- **Attributes and labels are validated before `render`**, so an extension never sees a malformed node. The errors come with document positions, like the built-ins' errors.
- **Behavior is linked through data attributes.** If a directive needs a browser half, its output carries `data-active-control="<extension>.<name>"` plus its own `data-*` attributes. The runtime finds controls by that name.
- **At the untrusted level, extension output passes through the same sanitizer.** An extension that needs extra elements or attributes declares them (`schema: { tagNames, attributes }`), and only names, never `script`, `style` or `on*` attributes, are accepted.
- **Rendering is pure:** no network or storage. Host data such as an asset registry is passed in by closure when the host builds the extension (`courseExtension(assets)`).

## 4. Controls (behavior)

```ts
type ControlSpec = {
  name: string;                              // matches data-active-control="<extension>.<name>"
  mount(el: HTMLElement, ctx: ControlContext): (() => void) | void; // returns cleanup
};

type ControlContext = {
  locale?: string;
  get(name: string): Result | undefined;
  set(name: string, value: number): string | undefined;   // same validation as :input
  compile(expr: string): CompiledExpression;
  watch(deps: ReadonlySet<string>, fn: () => void): () => void; // called when any dep changes
  format(value: number, spec?: string): string;
  emit(type: string, data: unknown): void;   // becomes { type: '<extension>.<type>', id, data } for the host
  id: string;                                // the directive's stable id
};
```

- **The runtime calls `mount` once per element**, and calls the cleanup on `destroy()`.
- **Controls get a session view, not the session.** Through it they can only set inputs and read values, the same as a reader.
- **React hosts** use components instead of `mount`, through hooks: `useActiveValue(expr)`, `useActiveInput(name)` and `useEmit()`. `@vchernoy/active-react` implements the context.

## 5. Functions and formats

```ts
type FunctionSpec = {
  name: string;                              // must not collide with a built-in
  arity: number | [min: number, max: number];
  impl(args: number[]): number | { error: string };
};

type FormatSpec = {
  name: string;                              // used as format=name or format=name:arg
  format(value: number, arg: string | undefined, locale: string | undefined): string;
};
```

- **Functions and formats are in the calc part** (§2), so the renderer and the runtime use the same implementations.
- **Functions are trusted only.** They must be pure and deterministic. Results are checked to be finite, and they count against the step budget like built-ins. An exception becomes an error value, so a function can never break a page.
- **Formats** run at both levels if the extension is `untrusted: true`. They only turn a number into text.

## 6. Events for the host

```ts
mount(root, { onEvent(e: ActiveEvent) { … } });

type ActiveEvent =
  | { type: 'change'; name: string; value: number }
  | { type: 'answer'; id: string; response: string; correct: boolean; points: number; max: number }
  | { type: 'error'; message: string }   // e.g. the page uses an extension mount wasn't given
  | { type: `${string}.${string}`; id: string; data: unknown };   // extension events
```

The host decides what an event means: save progress, record a score, unlock the next lesson. active-md never stores anything itself.

## 7. Stable ids

Answers and progress have to survive edits to the document, so every interactive directive gets an id:

- **An explicit `{#q1}`**, which wins and is required at the trusted level for anything scored;
- **otherwise a derived id:** the extension, the directive name, the label and the occurrence index (`answer:a*b:0`). This is stable while that question doesn't change, and it's reported as a warning when there are duplicates.

## 8. How course-platform features map

| Feature | Extension piece |
|---|---|
| `VideoPlayer`, `ResourceLink`, `DownloadFile` | `directives` with `jsx` output (its existing React components), `asset` attribute validated against its registry |
| `CourseImage`, `SiteImage` | a directive, or an image resolver hook for course-relative paths |
| Custom question types | `directives` + `controls` (or React components), `emit('answer', …)` |
| Finance helpers (`pmt`, `fv`) | `functions` |
| `currency:RUB`, dates | `formats` |
| Quiz storage, scores, unlocking | `onEvent` in the host |

The quiz itself (`:answer[expr]{tolerance points}`, `:::quiz`) ships in active-md as a built-in extension (`untrusted: true`), so TypeBridge documents can have questions too.

## 9. Plan

1. **0.2:** the registries in `remark-active` (directives) and `active-runtime` (controls, events), with `:input` and `:value` moved onto them, plus `defineExtension` / `defineBehavior` and tests that a host extension renders, validates and runs.
2. **0.2:** `defineCalc` (functions, formats), accepted by `parse`, `evaluate`, `createSession`, the renderer and `mount`. Acceptance test: a document using a custom function and a custom format, rendered on the server, mounted, then an input changed. The live values must match a fresh server render, and a `mount` without the extension must show an error, not a wrong value.
3. **0.3:** the quiz as a built-in extension, and `@vchernoy/active-react` (components and hooks).
4. **course-platform:** its extension package (video, resources, downloads, images), and then calc in its MDX pipeline (#9 phase 1–2).

## 10. Decisions needed

- [ ] Is one extension object with two halves (render, behavior) the right shape, or should there be separate registries?
- [ ] Should `untrusted: true` extensions be allowed in TypeBridge at all, or only built-ins?
- [ ] Should explicit `{#id}` be required for scored questions at the trusted level?
- [ ] For the MDX output (`jsx`), should course-platform keep MDX tags during the move, or switch to directives at once?
