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
- `input[data-active-input]` controls set inputs; several controls of one input stay in sync (the one being edited is never rewritten); values outside the input's range are rejected (`aria-invalid`, a `title` and the browser's validation message), and nothing changes.
- `[data-active-value]` views and `[data-active-tex]` formulas are redrawn only when a value they use changes. KaTeX is loaded on the first formula update (`loadKatex` to supply it yourself).
- Values the browser restored into controls (back/forward, autofill) are adopted on mount.
- Use the same `locale` (and math `output`) as the renderer so updated text matches the first render.

The optional stylesheet is scoped to `.active-doc`, sizes number/range controls, marks invalid inputs with the current text color, and honors KaTeX MathML column alignment. Override `--active-input-ch` (default `8`) to choose a number input width. Load this stylesheet with the renderer in lazy integrations; importing the runtime JavaScript does not load CSS automatically. It adds no fonts, requests or theme palette.
