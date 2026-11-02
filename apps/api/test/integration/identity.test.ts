import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/bootstrap';
import { DatabaseService } from '../../src/database/database.module';
import { SecurityKeys } from '../../src/identity/security-keys';
import { VerificationMessage } from '../../src/delivery/local-delivery';

if (
  process.env.MAYDON_TEST_DATABASE !== 'true' ||
  !new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')
)
  throw new Error('Dedicated test database required');
let app: Awaited<ReturnType<typeof createApp>>;
let db: DatabaseService;
const password = 'test-password-for-identity-123!';
const email = `${randomUUID()}@example.test`;
let access: string;
let refresh: string;
before(async () => {
  app = await createApp();
  await app.init();
  db = app.get(DatabaseService);
});
after(async () => {
  await app.close();
});
async function challenge(purpose: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const event = await db.outboxEvent.findFirstOrThrow({
    where: { recipientId: user.id, type: purpose },
    orderBy: { createdAt: 'desc' },
  });
  return app
    .get(SecurityKeys)
    .decrypt<VerificationMessage>(
      (event.payload as { envelope: string }).envelope,
    );
}
test('registration stores Argon2id, encrypted challenge, and returns generic response', async () => {
  const body = { email, password, displayName: 'Identity test', locale: 'uz' };
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(body)
    .expect(202, { accepted: true });
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(body)
    .expect(202, { accepted: true });
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  assert.match(user.passwordHash, /^\$argon2id\$/);
  assert.equal(user.emailVerifiedAt, null);
  const message = await challenge('VERIFY_EMAIL');
  const stored = await db.verificationChallenge.findUniqueOrThrow({
    where: { id: message.challengeId },
  });
  assert.notEqual(stored.codeHash, message.code);
});
test('email challenge is single use and failed attempts persist', async () => {
  const message = await challenge('VERIFY_EMAIL');
  const wrong = message.code === '000000' ? '000001' : '000000';
  await request(app.getHttpServer())
    .post('/api/v1/auth/email/verify')
    .send({ challengeId: message.challengeId, code: wrong })
    .expect(400);
  assert.equal(
    (
      await db.verificationChallenge.findUniqueOrThrow({
        where: { id: message.challengeId },
      })
    ).attempts,
    1,
  );
  const body = { challengeId: message.challengeId, code: message.code };
  await request(app.getHttpServer())
    .post('/api/v1/auth/email/verify')
    .send(body)
    .expect(200);
  await request(app.getHttpServer())
    .post('/api/v1/auth/email/verify')
    .send(body)
    .expect(400);
});
test('mobile rotation preserves expiry and reuse revokes the whole session', async () => {
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password, client: 'mobile' })
    .expect(200);
  access = login.body.accessToken;
  refresh = login.body.refreshToken;
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${access}`)
    .expect(200);
  const rotated = await request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .send({ client: 'mobile', refreshToken: refresh })
    .expect(200);
  assert.notEqual(rotated.body.refreshToken, refresh);
  assert.equal(rotated.body.refreshExpiresAt, login.body.refreshExpiresAt);
  await request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .send({ client: 'mobile', refreshToken: refresh })
    .expect(401);
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${rotated.body.accessToken}`)
    .expect(401);
});
test('web login uses secure cookies and refresh requires Origin and CSRF', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password, client: 'web' })
    .expect(403);
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Origin', 'http://localhost:5173')
    .send({ email, password, client: 'web' })
    .expect(200);
  assert.equal(login.body.refreshToken, undefined);
  assert.equal(login.headers['cache-control'], 'no-store');
  const cookies = login.headers['set-cookie'] as unknown as string[];
  assert.ok(
    cookies.some(
      (value) =>
        value.startsWith('__Host-maydon-refresh=') &&
        value.includes('HttpOnly') &&
        value.includes('Secure') &&
        value.includes('SameSite=Strict'),
    ),
  );
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const csrf = cookies
    .find((value) => value.startsWith('__Host-maydon-csrf='))!
    .split(';')[0]!
    .split('=')[1]!;
  await request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', cookie)
    .send({ client: 'web' })
    .expect(403);
  const rotated = await request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrf)
    .send({ client: 'web' })
    .expect(200);
  const revoked = await request(app.getHttpServer())
    .post('/api/v1/auth/sessions/revoke')
    .set('Origin', 'http://localhost:5173')
    .set('X-CSRF-Token', csrf)
    .set('Authorization', `Bearer ${rotated.body.accessToken}`)
    .expect(200);
  const cleared = revoked.headers['set-cookie'] as unknown as string[];
  assert.equal(cleared.length, 2);
  assert.ok(
    cleared.every((value) => value.includes('Expires=Thu, 01 Jan 1970')),
  );
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${rotated.body.accessToken}`)
    .expect(401);
});
test('password recovery revokes sessions and rejects reuse', async () => {
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password, client: 'mobile' })
    .expect(200);
  await request(app.getHttpServer())
    .post('/api/v1/auth/password/forgot')
    .send({ email })
    .expect(202, { accepted: true });
  const message = await challenge('RESET_PASSWORD');
  const body = {
    challengeId: message.challengeId,
    code: message.code,
    password,
  };
  await request(app.getHttpServer())
    .post('/api/v1/auth/password/reset')
    .send(body)
    .expect(200);
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/password/reset')
    .send(body)
    .expect(400);
});
test('admin MFA is mandatory, encrypted and replay protected', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.userRole.create({ data: { userId: user.id, role: 'ADMIN' } });
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password, client: 'mobile' })
    .expect(200);
  access = login.body.accessToken;
  const bearer = `Bearer ${access}`;
  assert.equal(login.body.mfaRequired, true);
  const denied = await request(app.getHttpServer())
    .patch('/api/v1/auth/me')
    .set('Authorization', bearer)
    .send({ locale: 'en' })
    .expect(403);
  assert.equal(denied.body.code, 'MFA_REQUIRED');
  const setup = await request(app.getHttpServer())
    .post('/api/v1/auth/mfa/setup')
    .set('Authorization', bearer)
    .send({ password })
    .expect(200);
  const { totpAt } = await import('../../src/identity/totp');
  const code = totpAt(setup.body.secret, Math.floor(Date.now() / 30000));
  await request(app.getHttpServer())
    .post('/api/v1/auth/mfa/confirm')
    .set('Authorization', bearer)
    .send({ code })
    .expect(200);
  const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.ok(stored.mfaEnabledAt);
  assert.ok(!stored.mfaSecretCiphertext!.includes(setup.body.secret));
  await request(app.getHttpServer())
    .patch('/api/v1/auth/me')
    .set('Authorization', bearer)
    .send({ locale: 'ru' })
    .expect(200);
  await request(app.getHttpServer())
    .post('/api/v1/auth/mfa/verify')
    .set('Authorization', bearer)
    .send({ code })
    .expect(400);
});
test('resource permission presets deny cross-owner access and viewer contacts', async () => {
  const { ResourceAccessService } = await import(
    '../../src/access/resource-access.service'
  );
  const accessService = app.get(ResourceAccessService);
  const users = await Promise.all(
    ['owner', 'other', 'viewer'].map((name) =>
      db.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          displayName: name,
          passwordHash: 'unused',
          emailVerifiedAt: new Date(),
        },
      }),
    ),
  );
  const [owner, other, viewer] = users;
  const business = await db.ownerProfile.create({
    data: {
      legalName: 'Access test',
      memberships: { create: { userId: owner!.id } },
    },
  });
  const facility = await db.facility.create({
    data: { ownerId: business.id, address: 'Test address' },
  });
  const resource = await db.bookableResource.create({
    data: { facilityId: facility.id, name: 'Test court' },
  });
  await assert.rejects(accessService.require(other!.id, resource.id, 'view'));
  await assert.rejects(
    accessService.assign(
      other!.id,
      resource.id,
      viewer!.id,
      'MANAGER',
      randomUUID(),
    ),
  );
  await accessService.assign(
    owner!.id,
    resource.id,
    viewer!.id,
    'VIEWER',
    randomUUID(),
  );
  await accessService.require(viewer!.id, resource.id, 'view');
  await assert.rejects(
    accessService.require(viewer!.id, resource.id, 'contact'),
  );
  await assert.rejects(accessService.require(viewer!.id, resource.id, 'book'));
  await assert.rejects(
    accessService.assign(
      viewer!.id,
      resource.id,
      other!.id,
      'MANAGER',
      randomUUID(),
    ),
  );
  await accessService.assign(
    owner!.id,
    resource.id,
    viewer!.id,
    'BOOKING_CLERK',
    randomUUID(),
  );
  await accessService.require(viewer!.id, resource.id, 'book');
  await assert.rejects(
    accessService.require(viewer!.id, resource.id, 'configure'),
  );
  await accessService.revoke(owner!.id, resource.id, viewer!.id, randomUUID());
  await assert.rejects(accessService.require(viewer!.id, resource.id, 'view'));
});
test('phone verification rejects another account and locks after five wrong codes', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.userRole.delete({
    where: { userId_role: { userId: user.id, role: 'ADMIN' } },
  });
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password, client: 'mobile' })
    .expect(200);
  assert.equal(login.body.mfaRequired, true);
  await request(app.getHttpServer())
    .patch('/api/v1/auth/me')
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .send({ locale: 'en' })
    .expect(403);
  const bearer = `Bearer ${access}`;
  await request(app.getHttpServer())
    .post('/api/v1/auth/phone/request')
    .set('Authorization', bearer)
    .send({ phone: '+998901234567' })
    .expect(202);
  const message = await challenge('VERIFY_PHONE');
  const { AuthService } = await import('../../src/identity/auth.service');
  const service = app.get(AuthService);
  const principal = await service.authenticate(access);
  await assert.rejects(
    service.verifyPhone(
      { ...principal, user: { ...principal.user, id: randomUUID() } },
      message.challengeId,
      message.code,
      { ip: 'phone-test', requestId: randomUUID(), web: false },
    ),
  );
  const wrong = message.code === '000000' ? '000001' : '000000';
  for (let attempt = 0; attempt < 5; attempt++) {
    await request(app.getHttpServer())
      .post('/api/v1/auth/phone/verify')
      .set('Authorization', bearer)
      .send({ challengeId: message.challengeId, code: wrong })
      .expect(400);
  }
  await request(app.getHttpServer())
    .post('/api/v1/auth/phone/verify')
    .set('Authorization', bearer)
    .send({ challengeId: message.challengeId, code: message.code })
    .expect(400);
  assert.equal(
    (
      await db.verificationChallenge.findUniqueOrThrow({
        where: { id: message.challengeId },
      })
    ).attempts,
    5,
  );
});
test('distributed limiter atomically admits only its configured capacity', async () => {
  const { RateLimitService } = await import(
    '../../src/identity/rate-limit.service'
  );
  const limiter = app.get(RateLimitService);
  const subject = randomUUID();
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      limiter.consume('test-concurrent', subject, 3, 60000),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    3,
  );
  assert.equal(
    results.filter(
      (result) =>
        result.status === 'rejected' && result.reason.getStatus() === 429,
    ).length,
    17,
  );
});
test('local delivery uses private files, deduplicates and contains no console transport', async () => {
  const { LocalDeliveryAdapter } = await import(
    '../../src/delivery/local-delivery'
  );
  const { digest } = await import('../../src/identity/security-keys');
  const { readFile, stat } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const message = await challenge('VERIFY_EMAIL');
  const eventKey = `test-delivery:${randomUUID()}`;
  const adapter = app.get(LocalDeliveryAdapter);
  const envelope = app.get(SecurityKeys).encrypt(message);
  await adapter.deliver(eventKey, envelope);
  await adapter.deliver(eventKey, envelope);
  const path = resolve(
    process.env.DEV_DELIVERY_DIR!,
    `${digest(eventKey)}.json`,
  );
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(
    JSON.parse(await readFile(path, 'utf8')).adapter,
    'LOCAL_TEST_ONLY',
  );
  assert.equal(JSON.parse(await readFile(path, 'utf8')).code, message.code);
});
test('concurrent refresh admits one rotation then revokes on duplicate use', async () => {
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password, client: 'mobile' })
    .expect(200);
  const results = await Promise.all(
    Array.from({ length: 2 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ client: 'mobile', refreshToken: login.body.refreshToken }),
    ),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set(
      'Authorization',
      `Bearer ${results.find((result) => result.status === 200)!.body.accessToken}`,
    )
    .expect(401);
});
