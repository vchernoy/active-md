/** Documents in share links: deflate-raw, then base64url, in `#doc=…`. Nothing leaves the browser. */
const PREFIX = '#doc=';

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

/** Shared documents are text; refuse anything that inflates past this (a "zip bomb" link). */
export const MAX_DOCUMENT_BYTES = 1_000_000;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error('the shared document is too large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

export class DocumentTooLarge extends Error {
  constructor(readonly bytes: number) { super('the document is too large to share'); }
}

/** Throws DocumentTooLarge for documents that a link couldn't open again (see MAX_DOCUMENT_BYTES). */
export async function encodeDocument(markdown: string): Promise<string> {
  const bytes = new TextEncoder().encode(markdown);
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new DocumentTooLarge(bytes.byteLength);
  const packed = await pipe(bytes, new CompressionStream('deflate-raw'));
  return PREFIX + toBase64Url(packed);
}

/** The document in a hash, undefined if there is none; throws if the link is damaged. */
export async function decodeDocument(hash: string): Promise<string | undefined> {
  if (!hash.startsWith(PREFIX)) return undefined;
  const raw = await pipe(fromBase64Url(hash.slice(PREFIX.length)), new DecompressionStream('deflate-raw'), MAX_DOCUMENT_BYTES);
  return new TextDecoder('utf-8', { fatal: true }).decode(raw);
}
