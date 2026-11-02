import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createApp, createDocument } from './bootstrap';

async function main() {
  // Offline schema generation never starts a server or persists credentials.
  process.env.AUTH_SECRET ??= randomBytes(48).toString('base64url');
  const app = await createApp();
  try {
    writeFileSync(
      '../../docs/openapi.json',
      JSON.stringify(createDocument(app), null, 2) + '\n',
    );
  } finally {
    await app.close();
  }
}
void main();
