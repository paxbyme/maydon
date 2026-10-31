import { writeFileSync } from 'node:fs';
import { createApp, createDocument } from './bootstrap';

async function main() {
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
