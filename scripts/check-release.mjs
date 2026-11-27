// Checks that the packages are ready to publish: one version everywhere (matching the tag, if given),
// internal dependencies pinned to it, and tarballs that contain only what consumers need.
// Usage: node scripts/check-release.mjs [v0.1.0]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PACKAGES = ['packages/calc', 'packages/remark', 'packages/runtime'];
const ALLOWED = [/^package\.json$/, /^README\.md$/, /^LICENSE$/, /^dist\//];

const problems = [];
const manifests = PACKAGES.map(dir => ({ dir, pkg: JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')) }));
const names = new Set(manifests.map(m => m.pkg.name));
const version = manifests[0].pkg.version;

const tag = process.argv[2];
if (tag && tag !== `v${version}`) problems.push(`tag ${tag} does not match package version ${version}`);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) problems.push(`"${version}" is not a release version`);

for (const { dir, pkg } of manifests) {
  if (pkg.version !== version) problems.push(`${pkg.name} is ${pkg.version}, expected ${version}`);
  if (pkg.private) problems.push(`${pkg.name} is private`);
  if (pkg.publishConfig?.access !== 'public') problems.push(`${pkg.name}: publishConfig.access must be "public"`);
  if (pkg.repository?.directory !== dir) problems.push(`${pkg.name}: repository.directory must be ${dir}`);
  for (const [dep, range] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies })) {
    if (names.has(dep) && range !== version) problems.push(`${pkg.name} depends on ${dep}@${range}, expected ${version}`);
  }
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: dir, encoding: 'utf8' }));
  const files = packed.files.map(f => f.path);
  for (const f of files) if (!ALLOWED.some(re => re.test(f)) && !(dir === 'packages/runtime' && ['style.css', 'sketch.css', 'styles.css'].includes(f))) problems.push(`${pkg.name} would publish ${f}`);
  for (const need of ['dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE', ...(dir === 'packages/runtime' ? ['style.css', 'sketch.css', 'styles.css'] : [])]) {
    if (!files.includes(need)) problems.push(`${pkg.name} is missing ${need} (did the build run?)`);
  }
  if (files.some(f => /\.test\.|\/test\//.test(f))) problems.push(`${pkg.name} would publish tests`);
  console.log(`${pkg.name}@${pkg.version}: ${files.length} files, ${(packed.size / 1024).toFixed(1)} kB packed`);
}

if (problems.length) {
  console.error(`\nNot ready to publish:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nReady to publish.');
