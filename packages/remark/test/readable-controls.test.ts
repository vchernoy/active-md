import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { DEFAULT_LIMITS } from '@vchernoy/calc';
import { renderActive } from '../src/index.js';
const calc = '```calc\ninput x = 2 in 0..10\ny = x * 3\n```\n\n';
it.each([':edit{input=x}', '::edit{input=x}', ':slider{input=x}', '::slider{input=x}'])('supports omitted labels in %s', directive => {
  const result = renderActive(calc + directive);
  expect(result.messages).toEqual([]); expect(result.html).toContain('data-active-input="x"'); expect(result.html).toContain('aria-label="x"');
  expect(result.html).not.toContain('active-input-label');
});
it.each([':edit[Investment]{input=x}', ':slider[Investment]{input=x}'])('keeps brackets accessible-only in %s', directive => {
  const result = renderActive(calc + directive);
  expect(result.messages).toEqual([]); expect(result.html).toContain('aria-label="Investment"');
  expect(result.html).not.toContain('>Investment<'); expect(result.html).not.toContain('active-input-label');
});
it('preserves inline prose, punctuation and formatted accessible labels', () => {
  const result = renderActive(calc + 'Start :edit[**Initial** investment]{input=x}, at :slider{input=x step=0.1}% a year.');
  expect(result.messages).toEqual([]); expect(result.html).toContain('<p>Start '); expect(result.html).toContain('</label>, at '); expect(result.html).toContain('</label>% a year.</p>');
  expect(result.html).toContain('aria-label="Initial investment"'); expect(result.html).not.toContain('<strong>Initial</strong>');
});
it('reuses legacy control output and permits synchronized mixed syntax', () => {
  expect(renderActive(calc + ':edit{input=x}').html).toBe(renderActive(calc + ':input[x]').html);
  expect(renderActive(calc + ':slider{input=x step=0.5}').html).toBe(renderActive(calc + ':input[x]{widget=slider step=0.5}').html);
  const result = renderActive(calc + ':input[x]{label="Visible legacy label"} :edit[New name]{input=x} :slider{input=x}');
  expect(result.messages).toEqual([]); expect(result.html).toContain('>Visible legacy label</span>');
  expect(result.html.match(/data-active-input="x"/g)).toHaveLength(3);
});
it.each([':edit', '::slider', ':edit{input=missing}', ':slider{input=y}', ':edit{input=x value=9}', ':slider{input=x widget=number}', ':edit{input=x label=Visible}', ':slider{input=x min=-1}', ':edit{input=x step=0}', ':edit{input=x step=3}'])('reports positioned invalid control %s', directive => {
  const result = renderActive(calc + directive);
  expect(result.messages).toHaveLength(1); expect(result.messages[0]).toMatchObject({ line: 6, column: 1 });
  expect(result.html).not.toContain('data-active-input=');
});
it('checks shared ranges across legacy and readable directives', () => {
  const result = renderActive(calc + ':input[x] :slider{input=x max=9}');
  expect(result.messages.some(message => message.message.includes('same range'))).toBe(true);
});
it('includes readable controls in hidden-control reachability and seed exclusion', () => {
  const hidden = renderActive(calc + ':::when[x]\n:edit{input=x}\n:::');
  expect(hidden.messages.some(message => message.message.includes('only control'))).toBe(true);
  const seed = renderActive(calc + ':::::when[0]\n::edit{input=x}\n:::::\n\n:::question{type=number}\n:answer[2]\n:::\n\n::quiz-submit[Check]{seed=x}');
  expect(seed.messages.some(message => message.message.includes('reader-editable'))).toBe(true);
});
it('escapes label text and rejects ranges missing from slider controls', () => {
  const result = renderActive(calc + ':edit[<img src=x onerror=alert(1)>]{input=x}');
  const dom = new JSDOM(result.html);
  expect(dom.window.document.querySelectorAll('img,script,[onerror]')).toHaveLength(0);
  expect(dom.window.document.querySelector('input')?.getAttribute('aria-label')).toBe('<img src=x onerror=alert(1)>');
  dom.window.close();
  expect(renderActive('```calc\ninput x = 2\n```\n\n:slider{input=x}').messages.some(message => message.message.includes('needs a range'))).toBe(true);
});

it('uses proven Calc constants for control ranges, step and choice values', () => {
  const source = [
    '```calc', 'limit = 10', 'increment = sqrt(limit - 6)', 'input x = 2 in -10..10', 'input choice = 2', '```', '',
    ':slider[Amount]{input=x min="-limit" max=limit step=increment}', '',
    ':::radio[Radio]{input=choice}', '::option[First]{value=increment}', '::option[Second]{value="increment * 2"}', ':::', '',
    ':::select[Select]{input=choice}', '::option[First]{value=increment}', '::option[Second]{value="increment * 2"}', ':::',
  ].join('\n');
  const result = renderActive(source);
  expect(result.messages).toEqual([]);
  const document = new JSDOM(result.html).window.document;
  const slider = document.querySelector<HTMLInputElement>('input[type=range]');
  expect([slider?.min, slider?.max, slider?.step]).toEqual(['-10', '10', '2']);
  expect([...document.querySelectorAll<HTMLInputElement>('input[type=radio]')].map(input => input.value)).toEqual(['2', '4']);
  expect([...document.querySelectorAll<HTMLOptionElement>('select option')].map(option => option.value)).toEqual(['2', '4']);
});

it.each([
  [':slider[Amount]{input=x min=0 max=dynamic}', 'finite numeric constant'],
  [':slider[Amount]{input=x min=0 max=unknown}', 'unknown name'],
  [':slider[Amount]{input=x min=0 max="1 / 0"}', 'division by zero'],
  [':slider[Amount]{input=x min=0 max=10 step="-limit"}', 'positive'],
  [':::radio[Choice]{input=x}\n::option[First]{value=2}\n::option[Second]{value="limit / 5"}\n:::', 'unique'],
])('reports invalid resolved control metadata at its directive', (control, message) => {
  const result = renderActive('```calc\ninput x = 2 in 0..10\ndynamic = x * 2\nlimit = 10\n```\n\n' + control);
  expect(result.messages).toEqual([expect.objectContaining({ line: 7, column: 1, message: expect.stringContaining(message) })]);
});

it('rejects a closed control expression when its step budget is exhausted', () => {
  const source = '```calc\ninput x = 2 in 0..10\n```\n\n:slider[Amount]{input=x max="2 + 8"}';
  const result = renderActive(source, { limits: { ...DEFAULT_LIMITS, maxSteps: 1 } });
  expect(result.messages).toContainEqual(expect.objectContaining({ line: 5, message: expect.stringContaining('finite numeric constant') }));
  expect(result.html).not.toContain('type="range"');
});

it.each(['::edit[**Investment**]{input=x}', '::slider[**Investment**]{input=x}'])('makes explicit leaf labels visible, semantic and text-only: %s', directive => {
  const result = renderActive(calc + directive);
  expect(result.messages).toEqual([]);
  const document = new JSDOM(result.html).window.document;
  const control = document.querySelector('input')!;
  expect(control.closest('label')?.querySelector('.active-input-label')?.textContent).toBe('Investment');
  expect(control.getAttribute('aria-label')).toBe('Investment');
  expect(document.querySelector('strong')).toBeNull();
});
