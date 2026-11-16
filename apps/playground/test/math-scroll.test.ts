// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { watchMathScroll } from '../src/math-scroll';
afterEach(() => vi.unstubAllGlobals());

it('tracks overflow, resize and live content, then disconnects without late updates', async () => {
  let resized = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback; }
    observe() {} disconnect = disconnect;
  });
  const doc = document.createElement('article');
  doc.innerHTML = '<div class="active-math-display">formula</div>';
  const formula = doc.firstElementChild as HTMLElement;
  const hint = document.createElement('p'); hint.id = 'hint';
  let width = 300; let content = 500;
  Object.defineProperties(formula, { clientWidth: { get: () => width }, scrollWidth: { get: () => content } });
  const stop = watchMathScroll(doc, hint);
  expect(hint.hidden).toBe(false);
  expect(formula.tabIndex).toBe(0);
  expect(formula.getAttribute('aria-describedby')).toBe('hint');
  width = 600; resized();
  expect(hint.hidden).toBe(true);
  expect(formula.hasAttribute('tabindex')).toBe(false);
  content = 700; formula.textContent = 'longer live formula';
  await vi.waitFor(() => expect(hint.hidden).toBe(false));
  stop(); expect(disconnect).toHaveBeenCalledOnce();
  expect(hint.hidden).toBe(true); expect(formula.hasAttribute('tabindex')).toBe(false);
  resized(); expect(hint.hidden).toBe(true);
});
