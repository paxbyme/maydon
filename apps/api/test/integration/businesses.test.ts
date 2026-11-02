import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
async function actor(admin = false, verified = true, mfa = true) {
  const user = await db.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: 'unused-fixture',
      displayName: 'Applicant',
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
      mfaVerifiedAt: admin && mfa ? new Date() : null,
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
  return { user, token: `Bearer ${token}` };
}
const submission = {
  legalName: 'Namangan sport operator',
  evidence:
    'Private ownership evidence: registration reference and verification instructions.',
};
async function submit(token: string) {
  return request(app.getHttpServer())
    .post('/api/v1/businesses')
    .set('Authorization', token)
    .send(submission)
    .expect(201);
}
test('business endpoints deny guests, unverified applicants, non-admins and MFA-pending admins', async () => {
  const player = await actor();
  const unverified = await actor(false, false);
  const pending = await actor(true, true, false);
  await request(app.getHttpServer()).get('/api/v1/businesses').expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/businesses')
    .set('Authorization', unverified.token)
    .send(submission)
    .expect(403);
  for (const token of [player.token, pending.token])
    await request(app.getHttpServer())
      .get('/api/v1/admin/businesses')
      .set('Authorization', token)
      .expect(403);
});
test('concurrent submissions create one pending application and evidence never leaks in list responses', async () => {
  const owner = await actor();
  const other = await actor();
  const results = await Promise.all(
    Array.from({ length: 12 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/businesses')
        .set('Authorization', owner.token)
        .send(submission),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 11);
  const id = results.find((r) => r.status === 201)!.body.id;
  const stored = await db.ownerProfile.findUniqueOrThrow({ where: { id } });
  assert.ok(stored.evidenceCiphertext);
  assert.ok(!stored.evidenceCiphertext.includes(submission.evidence));
  const own = await request(app.getHttpServer())
    .get('/api/v1/businesses')
    .set('Authorization', owner.token)
    .expect(200);
  assert.equal(own.body.items.length, 1);
  assert.equal(own.body.items[0].evidenceCiphertext, undefined);
  assert.equal(own.body.items[0].evidence, undefined);
  assert.equal(own.headers['cache-control'], 'no-store');
  const hidden = await request(app.getHttpServer())
    .get('/api/v1/businesses')
    .set('Authorization', other.token)
    .expect(200);
  assert.equal(hidden.body.items.length, 0);
  await request(app.getHttpServer())
    .put(`/api/v1/businesses/${id}/submission`)
    .set('Authorization', other.token)
    .send(submission)
    .expect(404);
  await request(app.getHttpServer())
    .get(`/api/v1/admin/businesses/${id}/evidence`)
    .set('Authorization', owner.token)
    .expect(403);
});
test('private evidence reads and one winning review are audited; notifications commit with the decision', async () => {
  const owner = await actor();
  const admin = await actor(true);
  const secondAdmin = await actor(true);
  const id = (await submit(owner.token)).body.id;
  const evidence = await request(app.getHttpServer())
    .get(`/api/v1/admin/businesses/${id}/evidence`)
    .set('Authorization', admin.token)
    .expect(200);
  assert.equal(evidence.body.evidence, submission.evidence);
  assert.equal(evidence.headers['cache-control'], 'no-store');
  const outcomes = await Promise.all(
    [admin, secondAdmin].map((a) =>
      request(app.getHttpServer())
        .put(`/api/v1/admin/businesses/${id}/review`)
        .set('Authorization', a.token)
        .send({
          decision: 'REJECTED',
          reason: 'Please provide a verifiable ownership reference.',
        }),
    ),
  );
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await db.auditEvent.count({
      where: { entityId: id, action: 'BUSINESS_REVIEWED' },
    }),
    1,
  );
  assert.equal(
    await db.auditEvent.count({
      where: { entityId: id, action: 'BUSINESS_EVIDENCE_VIEWED' },
    }),
    1,
  );
  assert.equal(
    await db.outboxEvent.count({
      where: { recipientId: owner.user.id, type: 'BUSINESS_REVIEWED' },
    }),
    1,
  );
  await request(app.getHttpServer())
    .put(`/api/v1/businesses/${id}/submission`)
    .set('Authorization', owner.token)
    .send({
      ...submission,
      evidence: 'Updated ownership verification reference for manual review.',
    })
    .expect(200);
  const resubmitted = await db.ownerProfile.findUniqueOrThrow({
    where: { id },
  });
  assert.equal(resubmitted.status, 'PENDING');
  assert.equal(resubmitted.reviewReason, null);
  await request(app.getHttpServer())
    .put(`/api/v1/admin/businesses/${id}/review`)
    .set('Authorization', admin.token)
    .send({ decision: 'APPROVED', reason: 'Ownership independently verified.' })
    .expect(200);
  await request(app.getHttpServer())
    .put(`/api/v1/businesses/${id}/submission`)
    .set('Authorization', owner.token)
    .send(submission)
    .expect(409);
});
test('administrators cannot approve their own business and malformed evidence is rejected', async () => {
  const admin = await actor(true);
  const id = (await submit(admin.token)).body.id;
  await request(app.getHttpServer())
    .put(`/api/v1/admin/businesses/${id}/review`)
    .set('Authorization', admin.token)
    .send({ decision: 'APPROVED', reason: 'Ownership verified.' })
    .expect(403);
  const owner = await actor();
  for (const evidence of ['short', ' '.repeat(40), 'x'.repeat(5001)])
    await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', owner.token)
      .send({ ...submission, evidence })
      .expect(400);
  await request(app.getHttpServer())
    .get('/api/v1/businesses?cursor=invalid')
    .set('Authorization', owner.token)
    .expect(400);
});
test('owner pagination is bounded, stable and does not expose another owner', async () => {
  const owner = await actor();
  for (let i = 0; i < 27; i++)
    await db.ownerProfile.create({
      data: {
        legalName: `Business ${i}`,
        memberships: { create: { userId: owner.user.id } },
      },
    });
  const first = await request(app.getHttpServer())
    .get('/api/v1/businesses')
    .set('Authorization', owner.token)
    .expect(200);
  assert.equal(first.body.items.length, 25);
  assert.ok(first.body.nextCursor);
  const next = await request(app.getHttpServer())
    .get(`/api/v1/businesses?cursor=${first.body.nextCursor}`)
    .set('Authorization', owner.token)
    .expect(200);
  assert.equal(next.body.items.length, 2);
  assert.equal(next.body.nextCursor, null);
  assert.equal(
    new Set(
      [...first.body.items, ...next.body.items].map(
        (x: { id: string }) => x.id,
      ),
    ).size,
    27,
  );
});
