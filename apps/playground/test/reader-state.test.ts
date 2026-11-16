// @vitest-environment jsdom
import { URL as NodeURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  localStorage.clear();
  history.replaceState(null, '', '/');
  document.documentElement.innerHTML = readFileSync(new NodeURL('../index.html', import.meta.url), 'utf8');
});

it('preserves accepted inputs across mode switches, with explicit reset and source isolation', async () => {
  const text = '```calc\ninput x = 2 in 1..10\ninput seed = 3\ny = x + seed\n```\n\n:input[x] :value[y]';
  localStorage.setItem('active-md.playground.source.v1', text);
  await import('../src/main');
  await vi.waitFor(() => expect(document.body.dataset.mode).toBe('edit'));
  const click = (id: string) => document.getElementById(id)!.click();
  const control = () => document.querySelector<HTMLInputElement>('[data-active-input="x"]')!;
  click('mode-view');
  control().value = '5'; control().dispatchEvent(new Event('input'));
  expect(document.querySelector('output')!.textContent).toBe('8');
  click('mode-edit'); click('mode-view');
  expect(control().value).toBe('5');
  expect(document.querySelector('output')!.textContent).toBe('8');
  expect(localStorage.getItem('active-md.playground.source.v1')).toBe(text);
  click('reset-values');
  expect(control().value).toBe('2');
  expect(document.querySelector('output')!.textContent).toBe('5');
  control().value = '6'; control().dispatchEvent(new Event('input'));
  click('mode-edit');
  const source = document.getElementById('source') as HTMLTextAreaElement;
  source.value = text + '\n\nEdited'; source.dispatchEvent(new Event('input'));
  click('mode-view');
  expect(control().value).toBe('2');
  expect(document.getElementById('reader-state-help')!.textContent).toContain('authored defaults');
});
