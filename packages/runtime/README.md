# @vchernoy/active-runtime

Makes a document rendered by [`@vchernoy/remark-active`](../remark/README.md) live in the browser. Plain DOM, no framework.

```ts
import { renderActive } from '@vchernoy/remark-active';   // on the server, or in the browser
import { mount } from '@vchernoy/active-runtime';

container.innerHTML = renderActive(markdown, { locale }).html;
const live = mount(container, { locale });   // later: live.destroy()
```

- Reads the calc program from `data-active-calc` on `.active-doc` and starts a session.
- `input[data-active-input]` controls set inputs; values outside the input's range are rejected (`aria-invalid`, a `title` and the browser's validation message), and nothing changes.
- `[data-active-value]` views and `[data-active-tex]` formulas are redrawn only when a value they use changes. KaTeX is loaded on the first formula update (`loadKatex` to supply it yourself).
- Values the browser restored into controls (back/forward, autofill) are adopted on mount.
- Use the same `locale` (and math `output`) as the renderer so updated text matches the first render.
