import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const template = readFileSync(
  new URL('../.env.example', import.meta.url),
  'utf8',
);
try {
  writeFileSync(
    new URL('../.env', import.meta.url),
    template.replace(
      'replace-with-a-random-secret-at-least-32-characters',
      randomBytes(48).toString('base64url'),
    ),
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    'Created private local .env. Existing configuration is never overwritten.',
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved.');
}
