import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Locale } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createApp } from '../../src/bootstrap';
import { DatabaseService } from '../../src/database/database.module';
import { SecurityKeys } from '../../src/identity/security-keys';
if (
  process.env.MAYDON_TEST_DATABASE !== 'true' ||
  !new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')
)
  throw new Error('Dedicated test database required');
let app: Awaited<ReturnType<typeof createApp>>;
let db: DatabaseService;
before(async () => {
  app = await createApp();
  await app.init();
  db = app.get(DatabaseService);
});
after(async () => {
  await app.close();
});
async function actor(admin = true, verified = true, mfa = true) {
  const user = await db.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: 'unused-fixture',
      displayName: 'Catalog editor',
      emailVerifiedAt: verified ? new Date() : null,
      roles: { create: { role: admin ? 'ADMIN' : 'PLAYER' } },
    },
  });
  const session = await db.session.create({
    data: {
      userId: user.id,
      csrfHash: 'a'.repeat(64),
      web: false,
      expiresAt: new Date(Date.now() + 600000),
      mfaVerifiedAt: mfa ? new Date() : null,
    },
  });
  const token = await new JwtService().signAsync(
    { sub: user.id, sid: session.id, kind: 'access' },
    {
      secret: app.get(SecurityKeys).jwtKey(),
      algorithm: 'HS256',
      issuer: 'maydon',
      audience: 'maydon-api',
      expiresIn: 600,
    },
  );
  return `Bearer ${token}`;
}
const translations: Array<{ locale: Locale; name: string }> = [
  { locale: 'uz', name: 'Sinov sporti' },
  { locale: 'ru', name: 'Тестовый спорт' },
  { locale: 'en', name: 'Test sport' },
];
const body = () => ({
  slug: `test-${randomUUID()}`,
  active: true,
  translations,
});
async function allPublic() {
  const items: Array<{
    id: string;
    slug: string;
    translations: Array<{ locale: string; name: string }>;
  }> = [];
  let cursor: string | null = null;
  do {
    const response: request.Response = await request(app.getHttpServer())
      .get('/api/v1/sports' + (cursor ? `?cursor=${cursor}` : ''))
      .expect(200);
    assert.ok(response.body.items.length <= 25);
    items.push(...response.body.items);
    cursor = response.body.nextCursor;
  } while (cursor);
  return items;
}
test('guest catalog includes translated initial sports and excludes inactive or incomplete records', async () => {
  const inactive = await db.sport.create({
    data: {
      slug: `hidden-${randomUUID()}`,
      active: false,
      translations: { create: translations },
    },
  });
  const incomplete = await db.sport.create({
    data: {
      slug: `incomplete-${randomUUID()}`,
      translations: { create: { locale: 'en', name: 'Incomplete' } },
    },
  });
  const list = await allPublic();
  for (const slug of ['football', 'basketball', 'volleyball', 'tennis']) {
    const sport = list.find((item) => item.slug === slug);
    assert.ok(sport);
    assert.equal(sport.translations.length, 3);
  }
  assert.ok(
    !list.some((item) => [inactive.id, incomplete.id].includes(item.id)),
  );
});
test('sports administration rejects guests, players, unverified admins and admins without MFA', async () => {
  await request(app.getHttpServer()).get('/api/v1/admin/sports').expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/admin/sports')
    .send(body())
    .expect(401);
  for (const token of [
    await actor(false),
    await actor(true, false),
    await actor(true, true, false),
  ]) {
    await request(app.getHttpServer())
      .get('/api/v1/admin/sports')
      .set('Authorization', token)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/admin/sports')
      .set('Authorization', token)
      .send(body())
      .expect(403);
    await request(app.getHttpServer())
      .put(`/api/v1/admin/sports/${randomUUID()}`)
      .set('Authorization', token)
      .send({ active: false, translations, expectedRevision: 1 })
      .expect(403);
  }
});
test('catalog validation enforces three unique locales and stable unique slugs', async () => {
  const token = await actor();
  const input = body();
  const created = await request(app.getHttpServer())
    .post('/api/v1/admin/sports')
    .set('Authorization', token)
    .send(input)
    .expect(201);
  await request(app.getHttpServer())
    .post('/api/v1/admin/sports')
    .set('Authorization', token)
    .send(input)
    .expect(409);
  for (const patch of [
    { slug: 'UPPER' },
    { slug: 'bad--slug' },
    { slug: 'x' },
    { translations: translations.slice(0, 2) },
    { translations: [translations[0], translations[0], translations[2]] },
    { translations: [null, null, null] },
    { active: 'true' },
  ]) {
    await request(app.getHttpServer())
      .post('/api/v1/admin/sports')
      .set('Authorization', token)
      .send({ ...body(), ...patch })
      .expect(400);
  }
  await request(app.getHttpServer())
    .put(`/api/v1/admin/sports/${created.body.id}`)
    .set('Authorization', token)
    .send({ active: true, translations, expectedRevision: 1, slug: 'renamed' })
    .expect(400);
  assert.equal(
    await db.auditEvent.count({
      where: { entityId: created.body.id, action: 'SPORT_CREATED' },
    }),
    1,
  );
});
test('deactivation preserves resource references and concurrent editors cannot overwrite each other', async () => {
  const token = await actor();
  const created = await request(app.getHttpServer())
    .post('/api/v1/admin/sports')
    .set('Authorization', token)
    .send(body())
    .expect(201);
  await db.bookableResource.create({
    data: {
      name: 'Referenced court',
      facility: {
        create: {
          address: 'Test street',
          owner: { create: { legalName: 'Catalog fixture' } },
        },
      },
      sports: { create: { sportId: created.body.id } },
    },
  });
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      request(app.getHttpServer())
        .put(`/api/v1/admin/sports/${created.body.id}`)
        .set('Authorization', token)
        .send({ active: false, translations, expectedRevision: 1 }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 9);
  assert.equal(
    await db.resourceSport.count({ where: { sportId: created.body.id } }),
    1,
  );
  assert.equal(
    await db.auditEvent.count({
      where: { entityId: created.body.id, action: 'SPORT_UPDATED' },
    }),
    1,
  );
  assert.ok(!(await allPublic()).some((item) => item.id === created.body.id));
  await request(app.getHttpServer())
    .put(`/api/v1/admin/sports/${created.body.id}`)
    .set('Authorization', token)
    .send({ active: true, translations, expectedRevision: 2 })
    .expect(200);
  assert.ok((await allPublic()).some((item) => item.id === created.body.id));
});
test('public and admin pages are bounded and private admin lists are not cached', async () => {
  for (let i = 0; i < 27; i++)
    await db.sport.create({
      data: {
        slug: `page-${randomUUID()}`,
        translations: { create: translations },
      },
    });
  const all = await allPublic();
  assert.equal(new Set(all.map((item) => item.id)).size, all.length);
  assert.ok(all.length > 25);
  const token = await actor();
  const admin = await request(app.getHttpServer())
    .get('/api/v1/admin/sports')
    .set('Authorization', token)
    .expect(200);
  assert.equal(admin.body.items.length, 25);
  assert.ok(admin.body.nextCursor);
  assert.equal(admin.headers['cache-control'], 'no-store');
  await request(app.getHttpServer())
    .get('/api/v1/sports?cursor=invalid')
    .expect(400);
});
