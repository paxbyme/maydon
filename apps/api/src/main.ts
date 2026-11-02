import { createApp, createDocument } from './bootstrap';
import { validateEnvironment } from './config';
import { SwaggerModule } from '@nestjs/swagger';

async function main() {
  const port = validateEnvironment(process.env);
  const app = await createApp();
  SwaggerModule.setup('api/v1/docs', app, createDocument(app));
  await app.listen(port, '0.0.0.0');
}
void main();
