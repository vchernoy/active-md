import { describe, expect, it, vi } from 'vitest';
import { publishedVersion, publishRelease } from './publish-release.mjs';

const sha = 'a'.repeat(40);
const manifests = ['calc', 'remark', 'runtime'].map(dir => ({ dir: `packages/${dir}`, name: `@example/${dir}`, version: '1.0.0' }));
const metadata = (index, gitHead) => ({ ...manifests[index], gitHead });

describe('release source preflight', () => {
  it('checks every package before publishing missing packages in dependency order', async () => {
    const events = [];
    await publishRelease(sha, manifests, {
      lookup: spec => { events.push(`view ${spec}`); return spec === '@example/calc@1.0.0' ? metadata(0, sha) : undefined; },
      publish: dir => events.push(`publish ${dir}`), log: () => {},
    });
    expect(events).toEqual([
      ...manifests.map(m => `view ${m.name}@${m.version}`),
      'publish packages/remark', 'publish packages/runtime',
    ]);
  });

  for (const invalid of [undefined, 'b'.repeat(40), 'short']) {
    it(`publishes nothing when a later existing package has unverified gitHead ${invalid}`, async () => {
      const publish = vi.fn();
      await expect(publishRelease(sha, manifests, {
        lookup: spec => spec === '@example/runtime@1.0.0' ? metadata(2, invalid) : undefined,
        publish,
      })).rejects.toThrow('matching source commit');
      expect(publish).not.toHaveBeenCalled();
    });
  }

  it('accepts an already-complete release only from its original commit', async () => {
    const publish = vi.fn();
    await publishRelease(sha, manifests, { lookup: spec => ({ ...manifests.find(m => spec === `${m.name}@${m.version}`), gitHead: sha }), publish, log: () => {} });
    expect(publish).not.toHaveBeenCalled();
  });

  it('stops when publication fails, allowing the workflow to withhold its tag', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('publish failed'));
    await expect(publishRelease(sha, manifests, { lookup: () => undefined, publish })).rejects.toThrow('publish failed');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('requires an exact source SHA before accessing npm', async () => {
    const lookup = vi.fn();
    await expect(publishRelease('main', manifests, { lookup })).rejects.toThrow('full source commit SHA');
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('registry lookup failures', () => {
  it('permits only an explicit npm E404 as an unpublished version', () => {
    const run = () => { throw { stdout: JSON.stringify({ error: { code: 'E404' } }) }; };
    expect(publishedVersion('@example/calc@1.0.0', run)).toBeUndefined();
  });

  for (const stdout of ['', '{malformed', JSON.stringify({ error: { code: 'E401' } }), JSON.stringify({ error: { code: 'ETIMEDOUT' } })]) {
    it(`fails closed on registry failure ${stdout}`, () => {
      expect(() => publishedVersion('@example/calc@1.0.0', () => { throw { stdout }; })).toThrow('npm lookup failed');
    });
  }
});
