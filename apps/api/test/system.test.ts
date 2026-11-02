import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, createDocument } from '../src/bootstrap';
import { validateEnvironment } from '../src/config';
import request from 'supertest';

test('only versioned public health/version endpoints are exposed', async () => {
  const app = await createApp();
  try {
    await app.init();
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/api/v1/version').expect(200, {
      service: 'maydon-api',
      version: '0.1.0',
      apiVersion: 'v1',
    });
    await request(app.getHttpServer()).get('/health').expect(404);
  } finally {
    await app.close();
  }
});

test('OpenAPI describes the public routes and response schema', async () => {
  const app = await createApp();
  try {
    const document = createDocument(app);
    assert.deepEqual(Object.keys(document.paths).sort(), [
      '/api/v1/health',
      '/api/v1/version',
    ]);
    assert.equal(
      document.paths['/api/v1/health']?.get?.operationId,
      'getHealth',
    );
    assert.deepEqual(document.components?.schemas?.HealthResponse, {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'] } },
      required: ['status'],
    });
  } finally {
    await app.close();
  }
});

test('foundation refuses production and invalid ports', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production' }),
    /not production-ready/,
  );
  for (const PORT of ['0', '65536', '3000x', '-1', '1.5', '']) {
    assert.throws(() => validateEnvironment({ PORT }));
  }
  assert.equal(validateEnvironment({}), 3000);
});
