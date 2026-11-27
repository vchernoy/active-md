/**
 * Document styles provided by `@vchernoy/active-runtime/styles.css`. A host offers these in a
 * picker and sets the chosen id as `data-active-style` on an ancestor of `.active-doc`.
 * `plain` means no attribute (or the value "plain"); unknown values render plain.
 */
export const ACTIVE_STYLES = [
  { id: 'plain', label: 'Plain' },
  { id: 'sketch', label: 'Hand-drawn' },
  { id: 'brutal', label: 'Bold (neo-brutalism)' },
  { id: 'notebook', label: 'Notebook' },
  { id: 'chalkboard', label: 'Chalkboard' },
] as const;

export type ActiveStyle = (typeof ACTIVE_STYLES)[number]['id'];

/** The style id for a stored or user-supplied value; anything unknown is `plain`. */
export function activeStyle(value: unknown): ActiveStyle {
  return ACTIVE_STYLES.some(style => style.id === value) ? value as ActiveStyle : 'plain';
}
