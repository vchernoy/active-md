import { describe, expect, it } from 'vitest';
import { decodeDocument, encodeDocument, MAX_DOCUMENT_BYTES } from '../src/share.js';

describe('share links', () => {
  it('round-trips documents, including non-Latin text', async () => {
    const md = '# Поездка\n\n```calc\ninput x = 1\n```\n\n:value[x] $$ {{x}} $$ — ✓';
    const hash = await encodeDocument(md);
    expect(hash).toMatch(/^#doc=[A-Za-z0-9_-]+$/);
    expect(await decodeDocument(hash)).toBe(md);
  });

  it('ignores other hashes and rejects damaged links', async () => {
    expect(await decodeDocument('')).toBeUndefined();
    expect(await decodeDocument('#section-2')).toBeUndefined();
    await expect(decodeDocument('#doc=!!!')).rejects.toThrow();
    await expect(decodeDocument('#doc=AAAA')).rejects.toThrow();
  });

  it('refuses links that inflate past the size limit', async () => {
    const hash = await encodeDocument('a'.repeat(MAX_DOCUMENT_BYTES + 1));
    expect(hash.length).toBeLessThan(5000);
    await expect(decodeDocument(hash)).rejects.toThrow(/too large/);
  });
});
