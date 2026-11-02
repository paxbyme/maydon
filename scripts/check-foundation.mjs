import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const root = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(root.engines.node, readFileSync('.nvmrc', 'utf8').trim());
assert.equal(root.engines.node, readFileSync('.node-version', 'utf8').trim());
for (const name of [
  'prd',
  'architecture',
  'database',
  'api',
  'security',
  'booking-engine',
  'game-management',
  'localization',
  'roadmap',
  'decisions',
  'development',
  'deployment',
  'testing',
]) {
  assert.ok(existsSync(`docs/${name}.md`), `Missing ${name} documentation`);
}
for (const name of ['player', 'owner', 'admin']) {
  assert.ok(existsSync(`apps/${name}/lib/main.dart`));
  assert.ok(existsSync(`apps/${name}/pubspec.yaml`));
}
for (const section of ['dependencies', 'devDependencies']) {
  for (const manifest of ['package.json', 'apps/api/package.json']) {
    for (const [name, version] of Object.entries(
      JSON.parse(readFileSync(manifest))[section] ?? {},
    )) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `Unpinned ${name}`);
    }
  }
}
console.log(
  'Foundation structure, runtime pins and documentation checks passed.',
);
