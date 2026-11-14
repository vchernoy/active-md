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

    const png = readFileSync(new URL(`../public/${image.pathname.slice(url.pathname.length)}`, import.meta.url));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(Number(property('og:image:width')));
    expect(png.readUInt32BE(20)).toBe(Number(property('og:image:height')));
    expect(property('og:image:type')).toBe('image/png');
  });
});
