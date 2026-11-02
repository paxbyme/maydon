import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, createDocument } from '../src/bootstrap';
import { validateEnvironment } from '../src/config';
import request from 'supertest';

process.env.AUTH_SECRET = 'test-only-secret-never-use-outside-tests-123456789';

test('versioned public health/version endpoints are exposed', async () => {
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
    const missing = await request(app.getHttpServer())
      .get('/health?token=do-not-echo')
      .set('X-Request-Id', 'untrusted-client-text')
      .expect(404);
    assert.equal(missing.body.code, 'NOT_FOUND');
    assert.match(missing.body.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(missing.headers['x-request-id'], missing.body.requestId);
    assert.ok(!JSON.stringify(missing.body).includes('do-not-echo'));
    assert.ok(!JSON.stringify(missing.body).includes('untrusted-client-text'));
  } finally {
    await app.close();
  }
});

test('OpenAPI describes the public routes and response schema', async () => {
  const app = await createApp();
  try {
    const document = createDocument(app);
    assert.ok(document.paths['/api/v1/auth/login']);
    assert.ok(document.paths['/api/v1/version']);
    assert.deepEqual(document.paths['/api/v1/auth/me']?.get?.security, [
      { bearer: [] },
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
