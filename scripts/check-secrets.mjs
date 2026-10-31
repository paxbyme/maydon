import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const skipped = new Set([
  '.git',
  '.toolchains',
  '.cache',
  'node_modules',
  '.dart_tool',
  'build',
  'dist',
]);
const patterns = [
  new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
  new RegExp('AKIA' + '[A-Z0-9]{16}'),
  new RegExp('ghp_' + '[A-Za-z0-9]{36}'),
];
let failures = 0;
function walk(dir) {
  for (const file of readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(file.name) || file.isSymbolicLink()) continue;
    const path = join(dir, file.name);
    if (file.isDirectory()) {
      walk(path);
      continue;
    }
    if (
      file.name === '.env' ||
      (file.name.startsWith('.env.') && file.name !== '.env.example')
    )
      continue;
    const contents = readFileSync(path, 'utf8');
    if (patterns.some((pattern) => pattern.test(contents))) {
      console.error(`Potential secret in ${path}`);
      failures++;
    }
  }
}
walk('.');
if (failures) process.exitCode = 1;
else
  console.log(
    'Basic secret-pattern check passed; CI additionally runs Gitleaks.',
  );
