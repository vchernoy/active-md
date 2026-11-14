import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderActive } from '../src/index.js';

const dir = fileURLToPath(new URL('../../../examples/', import.meta.url));
const examples = readdirSync(dir).filter(name => name.endsWith('.md') && name !== 'README.md').sort();

describe('examples/', () => {
  it('has the documented examples', () => {
    const index = readFileSync(dir + 'README.md', 'utf8');
    expect(examples.length).toBeGreaterThan(0);
    for (const name of examples) expect(index).toContain(`(${name})`);
  });

  it.each(examples)('%s renders without problems', name => {
    const { html, program, messages } = renderActive(readFileSync(dir + name, 'utf8'), { locale: 'en-US' });
    expect(messages).toEqual([]);
    expect(program).toBeDefined();
    expect(html).not.toContain('active-error');
    // A failed {{…}} in math becomes a red "?".
    expect(html).not.toMatch(/mathcolor="red"|color:\s*red/);
    // Every :input and :value is bound to the program.
    expect(html).toContain('data-active-input=');
    expect(html).toContain('data-active-value=');
  });
});
