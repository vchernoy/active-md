/** Playground-only affordances; the renderer's math and source stay unchanged. */
export function watchMathScroll(doc: HTMLElement, hint: HTMLElement): () => void {
  const formulas = [...doc.querySelectorAll<HTMLElement>('.active-math-display')];
  let stopped = false;
  const update = () => {
    if (stopped) return;
    let any = false;
    for (const formula of formulas) {
      const wide = formula.clientWidth > 0 && formula.scrollWidth > formula.clientWidth + 1;
      any ||= wide;
      if (wide) {
        formula.tabIndex = 0;
        formula.setAttribute('role', 'group');
        formula.setAttribute('aria-label', 'Scrollable formula');
        formula.setAttribute('aria-describedby', hint.id);
      } else {
        for (const name of ['tabindex', 'role', 'aria-label', 'aria-describedby']) formula.removeAttribute(name);
      }
    }
    hint.hidden = !any;
  };
  const resize = new ResizeObserver(update);
  resize.observe(doc);
  for (const formula of formulas) resize.observe(formula);
  const mutation = new MutationObserver(update);
  mutation.observe(doc, { childList: true, subtree: true, characterData: true });
  doc.ownerDocument.fonts?.addEventListener('loadingdone', update);
  void doc.ownerDocument.fonts?.ready.then(update);
  update();
  return () => {
    stopped = true;
    resize.disconnect();
    mutation.disconnect();
    doc.ownerDocument.fonts?.removeEventListener('loadingdone', update);
    hint.hidden = true;
    for (const formula of formulas) {
      for (const name of ['tabindex', 'role', 'aria-label', 'aria-describedby']) formula.removeAttribute(name);
    }
  };
}
