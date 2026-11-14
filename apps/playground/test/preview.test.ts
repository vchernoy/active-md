import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

describe('social link preview', () => {
  it('exposes a complete generic card without running JavaScript, backed by the public image', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const { document } = new JSDOM(html).window;
    const property = (name: string) => document.querySelector(`meta[property="${name}"]`)?.getAttribute('content');
    const named = (name: string) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
    const url = new URL(property('og:url')!);
    const image = new URL(property('og:image')!);
    expect(url.protocol).toBe('https:');
    expect(url.hash).toBe('');
    expect(image.origin).toBe(url.origin);
    expect(image.pathname.startsWith(url.pathname)).toBe(true);
    expect(property('og:type')).toBe('website');
    expect(property('og:title')).toBeTruthy();
    expect(property('og:description')).toBeTruthy();
    expect(property('og:image:alt')).toBeTruthy();
    expect(named('twitter:card')).toBe('summary_large_image');
    expect(named('twitter:image')).toBe(image.href);
    expect(named('twitter:title')).toBe(property('og:title'));
    expect(named('twitter:description')).toBe(property('og:description'));
    expect(named('twitter:image:alt')).toBe(property('og:image:alt'));

    const jpeg = readFileSync(new URL(`../public/${image.pathname.slice(url.pathname.length)}`, import.meta.url));
    expect(jpeg.subarray(0, 2).toString('hex')).toBe('ffd8');
    expect(jpeg.subarray(-2).toString('hex')).toBe('ffd9');
    expect(jpeg.length).toBeLessThan(250_000);
    // Read dimensions from the baseline/progressive JPEG frame, rather than trusting metadata constants.
    let dimensions: { width: number; height: number } | undefined;
    for (let offset = 2; offset + 8 < jpeg.length;) {
      expect(jpeg[offset]).toBe(0xff);
      const marker = jpeg[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        dimensions = { height: jpeg.readUInt16BE(offset + 5), width: jpeg.readUInt16BE(offset + 7) };
        break;
      }
      const length = jpeg.readUInt16BE(offset + 2);
      expect(length).toBeGreaterThanOrEqual(2);
      offset += length + 2;
    }
    expect(dimensions).toEqual({ width: Number(property('og:image:width')), height: Number(property('og:image:height')) });
    expect(property('og:image:type')).toBe('image/jpeg');
  });
});
