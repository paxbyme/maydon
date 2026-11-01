import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = readFileSync('apps/api/prisma/schema.prisma', 'utf8');
const directory = mkdtempSync(join(tmpdir(), 'maydon-prisma-format-'));
try {
  const path = join(directory, 'schema.prisma');
  writeFileSync(path, source);
  const result = spawnSync(
    process.execPath,
    [resolve('node_modules/prisma/build/index.js'), 'format', '--schema', path],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Prisma formatting check failed');
  }
  if (readFileSync(path, 'utf8') !== source) {
    throw new Error('Prisma schema needs formatting; run npm run db:format');
  }
  console.log('Prisma schema format check passed without changing source.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
