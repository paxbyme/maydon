import { lookup } from 'node:dns/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Diagnostics only: no package installs or Docker mutations. Flutter may refresh its SDK cache.
const checks = [];
function record(name, passed, detail) {
  checks.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}
function command(name, executable, args, detail) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, CI: 'true', FLUTTER_SUPPRESS_ANALYTICS: 'true' },
  });
  record(
    name,
    result.status === 0,
    result.status === 0
      ? detail
      : `${result.error?.code ?? `exit ${result.status ?? result.signal}`}; run ${executable} ${args.join(' ')} for details`,
  );
}
const expected = readFileSync('.nvmrc', 'utf8').trim();
record(
  'Node runtime',
  process.versions.node === expected,
  `expected ${expected}, running ${process.versions.node}`,
);
command(
  'Git repository',
  'git',
  ['rev-parse', '--is-inside-work-tree'],
  'repository exists (write access not tested)',
);
try {
  await lookup('registry.npmjs.org');
  record(
    'npm DNS',
    true,
    'registry.npmjs.org resolves; package access still requires installation',
  );
} catch (error) {
  record('npm DNS', false, error.code ?? 'lookup failed');
}
// Flutter itself may refresh SDK cache metadata even for --version.
command(
  'Flutter runtime',
  'flutter',
  ['--version'],
  'version command succeeded; compare output with .fvmrc before accepting',
);
command(
  'Docker daemon',
  'docker',
  ['info', '--format', '{{.ServerVersion}}'],
  'daemon is accessible',
);
command(
  'Compose configuration',
  'docker',
  ['compose', '-f', 'infra/compose.yaml', 'config', '--quiet'],
  'configuration is valid',
);
for (const path of [
  'package-lock.json',
  ...['player', 'owner', 'admin'].map((app) => `apps/${app}/pubspec.lock`),
  ...['localization', 'design_system', 'api_client'].map(
    (pkg) => `packages/${pkg}/pubspec.lock`,
  ),
  'apps/player/android/app/src/main/AndroidManifest.xml',
  'apps/player/ios/Runner.xcodeproj',
]) {
  record(
    path,
    existsSync(path),
    existsSync(path) ? 'present' : 'missing; see docs/development.md',
  );
}
const failures = checks.filter((check) => !check.passed).length;
console.log(
  `\n${checks.length - failures}/${checks.length} prerequisites pass. This does not replace builds or acceptance tests.`,
);
process.exitCode = failures ? 1 : 0;
