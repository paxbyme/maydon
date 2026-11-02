import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ReviewStatus } from '@prisma/client';
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
async function actor(
  status: ReviewStatus = 'APPROVED',
  verified = true,
  admin = false,
) {
  const user = await db.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: 'unused-fixture',
      displayName: 'Facility owner',
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
      mfaVerifiedAt: admin ? new Date() : null,
    },
  });
  const business = await db.ownerProfile.create({
    data: {
      legalName: 'Owner',
      status,
      memberships: { create: { userId: user.id } },
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
  return {
    user,
    business,
    token: `Bearer ${token}`,
    path: `/api/v1/businesses/${business.id}/facilities`,
  };
}
const draft = {
  address: 'Namangan, Test street 12',
  latitude: 40.9983,
  longitude: 71.6726,
  translations: [
    {
      locale: 'en',
      name: 'Namangan courts',
      description: 'Indoor sports courts in Namangan.',
    },
  ],
};
test('approved owner creates an audited private draft with localized content and fixed city/timezone', async () => {
  const owner = await actor();
  const created = await request(app.getHttpServer())
    .post(owner.path)
    .set('Authorization', owner.token)
    .send(draft)
    .expect(201);
  assert.equal(created.body.status, 'DRAFT');
  assert.equal(created.body.revision, 1);
  assert.equal(created.body.city, 'Namangan');
  assert.equal(created.body.timezone, 'Asia/Tashkent');
  assert.deepEqual(created.body.translations, draft.translations);
  assert.equal(
    await db.auditEvent.count({
      where: { entityId: created.body.id, action: 'FACILITY_CREATED' },
    }),
    1,
  );
  const page = await request(app.getHttpServer())
    .get(owner.path)
    .set('Authorization', owner.token)
    .expect(200);
  assert.equal(page.body.canEdit, true);
  assert.equal(page.body.items.length, 1);
  assert.equal(page.headers['cache-control'], 'no-store');
});
test('guests, unapproved businesses and unverified owners cannot create; other owners and admins cannot access', async () => {
  const owner = await actor();
  const other = await actor();
  const admin = await actor('APPROVED', true, true);
  await request(app.getHttpServer()).post(owner.path).send(draft).expect(401);
  for (const denied of [
    await actor('PENDING'),
    await actor('REJECTED'),
    await actor('SUSPENDED'),
    await actor('APPROVED', false),
  ]) {
    await request(app.getHttpServer())
      .post(denied.path)
      .set('Authorization', denied.token)
      .send(draft)
      .expect(403);
    const page = await request(app.getHttpServer())
      .get(denied.path)
      .set('Authorization', denied.token)
      .expect(200);
    assert.equal(page.body.canEdit, false);
  }
  const created = await request(app.getHttpServer())
    .post(owner.path)
    .set('Authorization', owner.token)
    .send(draft)
    .expect(201);
  for (const denied of [other, admin]) {
    await request(app.getHttpServer())
      .get(owner.path)
      .set('Authorization', denied.token)
      .expect(404);
    await request(app.getHttpServer())
      .post(owner.path)
      .set('Authorization', denied.token)
      .send(draft)
      .expect(404);
    await request(app.getHttpServer())
      .put(`${denied.path}/${created.body.id}`)
      .set('Authorization', denied.token)
      .send({ ...draft, expectedRevision: 1 })
      .expect(404);
  }
});
test('facility inputs reject invalid coordinates, duplicate locales, empty translations and privileged fields', async () => {
  const owner = await actor();
  for (const changes of [
    { latitude: 91 },
    { longitude: -181 },
    { latitude: 40.1234567 },
    { latitude: '40' },
    { translations: [] },
    { translations: [draft.translations[0], draft.translations[0]] },
    { translations: [null] },
    { translations: [{ ...draft.translations[0], locale: 'fr' }] },
    { translations: [{ ...draft.translations[0], name: '  ' }] },
    { status: 'APPROVED' },
    { timezone: 'UTC' },
    { ownerId: randomUUID() },
  ]) {
    await request(app.getHttpServer())
      .post(owner.path)
      .set('Authorization', owner.token)
      .send({ ...draft, ...changes })
      .expect(400);
  }
  assert.equal(
    await db.facility.count({ where: { ownerId: owner.business.id } }),
    0,
  );
});
test('concurrent draft edits accept exactly one revision and replace translations atomically', async () => {
  const owner = await actor();
  const created = await request(app.getHttpServer())
    .post(owner.path)
    .set('Authorization', owner.token)
    .send(draft)
    .expect(201);
  const responses = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      request(app.getHttpServer())
        .put(`${owner.path}/${created.body.id}`)
        .set('Authorization', owner.token)
        .send({
          ...draft,
          address: `Updated street ${index}`,
          expectedRevision: 1,
        }),
    ),
  );
  assert.equal(responses.filter((r) => r.status === 200).length, 1);
  assert.equal(responses.filter((r) => r.status === 409).length, 9);
  const stored = await db.facility.findUniqueOrThrow({
    where: { id: created.body.id },
    include: { translations: true },
  });
  assert.equal(stored.revision, 2);
  assert.equal(stored.translations.length, 1);
  assert.equal(
    stored.address,
    responses.find((r) => r.status === 200)!.body.address,
  );
  assert.equal(
    await db.auditEvent.count({
      where: { entityId: stored.id, action: 'FACILITY_UPDATED' },
    }),
    1,
  );
});
test('pending/published/suspended facilities cannot be silently edited; rejection returns to draft', async () => {
  const owner = await actor();
  const created = await request(app.getHttpServer())
    .post(owner.path)
    .set('Authorization', owner.token)
    .send(draft)
    .expect(201);
  for (const status of ['PENDING', 'APPROVED', 'SUSPENDED'] as const) {
    await db.facility.update({
      where: { id: created.body.id },
      data: { status },
    });
    await request(app.getHttpServer())
      .put(`${owner.path}/${created.body.id}`)
      .set('Authorization', owner.token)
      .send({ ...draft, address: 'Changed address', expectedRevision: 1 })
      .expect(409);
  }
  await db.facility.update({
    where: { id: created.body.id },
    data: { status: 'REJECTED', reviewReason: 'Clarify the address.' },
  });
  const updated = await request(app.getHttpServer())
    .put(`${owner.path}/${created.body.id}`)
    .set('Authorization', owner.token)
    .send({ ...draft, expectedRevision: 1 })
    .expect(200);
  assert.equal(updated.body.status, 'DRAFT');
  assert.equal(updated.body.reviewReason, null);
  assert.equal(updated.body.revision, 2);
});
test('facility list pagination is bounded and excludes soft-deleted facilities', async () => {
  const owner = await actor();
  await db.facility.createMany({
    data: Array.from({ length: 27 }, (_, i) => ({
      ownerId: owner.business.id,
      address: `Street ${i}`,
      deletedAt: i === 26 ? new Date() : null,
    })),
  });
  const first = await request(app.getHttpServer())
    .get(owner.path)
    .set('Authorization', owner.token)
    .expect(200);
  assert.equal(first.body.items.length, 25);
  const next = await request(app.getHttpServer())
    .get(`${owner.path}?cursor=${first.body.nextCursor}`)
    .set('Authorization', owner.token)
    .expect(200);
  assert.equal(next.body.items.length, 1);
  assert.equal(next.body.nextCursor, null);
  await db.ownerProfile.update({
    where: { id: owner.business.id },
    data: { deletedAt: new Date() },
  });
  await request(app.getHttpServer())
    .get(owner.path)
    .set('Authorization', owner.token)
    .expect(404);
});
