// Preflight every package before any publish: a retry may skip only the same source commit.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PACKAGES = ['packages/calc', 'packages/remark', 'packages/runtime'];

export function publishedVersion(spec, run = execFileSync) {
  let json;
  try {
    json = run('npm', ['view', spec, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    // Only npm's explicit not-found result permits a new publication. Network/auth errors fail closed.
    let result;
    try { result = JSON.parse(String(error.stdout)); } catch { /* Not a structured npm response. */ }
    if (result?.error?.code === 'E404') return undefined;
    throw new Error(`Cannot verify ${spec}: npm lookup failed`, { cause: error });
  }
  return JSON.parse(json);
}

export async function publishRelease(expectedSha, manifests, {
  lookup = publishedVersion,
  publish = dir => execFileSync('npm', ['publish', '--workspace', dir, '--provenance', '--access', 'public'], { stdio: 'inherit' }),
  log = console.log,
} = {}) {
  if (!/^[0-9a-f]{40}$/.test(expectedSha ?? '')) throw new Error('A full source commit SHA is required');
  const plan = [];
  for (const { dir, name, version } of manifests) {
    const spec = `${name}@${version}`;
    const published = await lookup(spec);
    if (published !== undefined && (
      published?.name !== name || published?.version !== version || published?.gitHead !== expectedSha
    )) {
      throw new Error(`${spec} is already published without matching source commit ${expectedSha}; refusing to publish or tag a mixed release`);
    }
    plan.push({ dir, spec, exists: published !== undefined });
  }
  // All registry checks have succeeded. Publish missing packages in dependency order.
  for (const item of plan) {
    if (item.exists) log(`${item.spec} already published from ${expectedSha}; skipping.`);
    else await publish(item.dir);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifests = PACKAGES.map(dir => {
    const { name, version } = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
    return { dir, name, version };
  });
  await publishRelease(process.argv[2], manifests);
}
