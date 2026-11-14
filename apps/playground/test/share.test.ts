import { describe, expect, it } from 'vitest';
import { decodeDocument, DocumentTooLarge, encodeDocument, MAX_DOCUMENT_BYTES } from '../src/share.js';

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
    // A hand-made link (encodeDocument refuses to make one this large).
    const packed = new Uint8Array(await new Response(
      new Blob([new TextEncoder().encode('a'.repeat(MAX_DOCUMENT_BYTES + 1))]).stream().pipeThrough(new CompressionStream('deflate-raw')),
    ).arrayBuffer());
    const hash = '#doc=' + btoa(String.fromCharCode(...packed)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(hash.length).toBeLessThan(5000);
    await expect(decodeDocument(hash)).rejects.toThrow(/too large/);
  });

  it('refuses to make links that could not be opened again', async () => {
    await expect(encodeDocument('a'.repeat(MAX_DOCUMENT_BYTES + 1))).rejects.toBeInstanceOf(DocumentTooLarge);
    // The limit counts UTF-8 bytes: Cyrillic letters take two.
    await expect(encodeDocument('я'.repeat(MAX_DOCUMENT_BYTES / 2 + 1))).rejects.toMatchObject({ bytes: MAX_DOCUMENT_BYTES + 2 });
    expect(await decodeDocument(await encodeDocument('я'.repeat(MAX_DOCUMENT_BYTES / 2)))).toHaveLength(MAX_DOCUMENT_BYTES / 2);
  });
});
