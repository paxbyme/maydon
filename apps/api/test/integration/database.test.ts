import 'reflect-metadata';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../src/database/database.module';
import { AuditService } from '../../src/audit/audit.service';
import { MAX_ATTEMPTS, OutboxService } from '../../src/outbox/outbox.service';

const url = process.env.DATABASE_URL;
if (
  process.env.MAYDON_TEST_DATABASE !== 'true' ||
  !url ||
  !new URL(url).pathname.endsWith('_test')
) {
  throw new Error(
    'Integration tests require MAYDON_TEST_DATABASE=true and a database ending in _test',
  );
}
const db = new DatabaseService();
const audit = new AuditService();
const outbox = new OutboxService(db);
let actorId: string;
let facilityId: string;
const start = new Date('2030-01-01T10:00:00Z');
const end = new Date('2030-01-01T11:00:00Z');

before(async () => {
  await db.$connect();
  actorId = (
    await db.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        passwordHash: 'test-only-not-an-auth-credential',
        displayName: 'Fixture',
      },
    })
  ).id;
  const owner = await db.ownerProfile.create({
    data: {
      legalName: 'Test facility operator',
      memberships: { create: { userId: actorId } },
    },
  });
  facilityId = (
    await db.facility.create({
      data: { ownerId: owner.id, address: 'Test address' },
    })
  ).id;
});
beforeEach(async () => {
  await db.outboxEvent.deleteMany();
});
after(async () => {
  await db.$disconnect();
});

function resource() {
  return db.bookableResource.create({
    data: { facilityId, name: 'Test resource' },
  });
}
function bookingData(
  resourceId: string,
  customerId = actorId,
  startAt = start,
  endAt = end,
) {
  return {
    reference: randomUUID().replaceAll('-', ''),
    resourceId,
    customerId,
    recordedById: customerId,
    origin: 'CUSTOMER' as const,
    startAt,
    endAt,
    priceMinor: 10000n,
    currency: 'UZS',
    priceSnapshot: { totalMinor: '10000' },
    cancellationCutoffMinutes: 120,
    policySnapshot: { cutoffMinutes: 120 },
  };
}
async function reserve(
  resourceId: string,
  customerId = actorId,
  from = start,
  to = end,
  occupiedStart = from,
  occupiedEnd = to,
) {
  return db.$transaction(
    async (tx) => {
      const booking = await tx.booking.create({
        data: bookingData(resourceId, customerId, from, to),
      });
      await tx.resourceOccupancy.create({
        data: { resourceId, bookingId: booking.id, occupiedStart, occupiedEnd },
      });
      return booking;
    },
    { maxWait: 20000, timeout: 20000 },
  );
}
async function block(resourceId: string) {
  return db.$transaction(async (tx) => {
    const record = await tx.resourceBlock.create({
      data: {
        resourceId,
        recordedById: actorId,
        reason: 'Maintenance',
        startAt: start,
        endAt: end,
      },
    });
    await tx.resourceOccupancy.create({
      data: {
        resourceId,
        blockId: record.id,
        occupiedStart: start,
        occupiedEnd: end,
      },
    });
    return record;
  });
}
function eventData(channel: 'IN_APP' | 'SMS' = 'IN_APP') {
  return {
    eventKey: randomUUID(),
    recipientId: actorId,
    channel,
    type: 'BOOKING_CONFIRMED',
    payload: { bookingId: randomUUID() },
  };
}

test('migration installed the actual PostgreSQL exclusion constraint', async () => {
  const rows = await db.$queryRaw<
    Array<{ contype: string; definition: string }>
  >`
    SELECT contype::text, pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conname = 'ResourceOccupancy_no_overlap'`;
  assert.equal(rows[0]?.contype, 'x');
  assert.match(rows[0]!.definition, /EXCLUDE USING gist/);
});

test('50 distinct customers racing for one interval commit exactly one booking', async () => {
  const target = await resource();
  const customers = Array.from({ length: 50 }, () => ({
    id: randomUUID(),
    email: `${randomUUID()}@example.test`,
    passwordHash: 'test-only',
    displayName: 'Customer',
  }));
  await db.user.createMany({ data: customers });
  const results = await Promise.allSettled(
    customers.map((customer) => reserve(target.id, customer.id)),
  );
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  for (const result of results) {
    if (result.status === 'rejected')
      assert.match(String(result.reason), /ResourceOccupancy_no_overlap/);
  }
  assert.equal(await db.booking.count({ where: { resourceId: target.id } }), 1);
  assert.equal(
    await db.resourceOccupancy.count({
      where: { resourceId: target.id, active: true },
    }),
    1,
  );
});

test('a customer reservation and maintenance block cannot overlap under a race', async () => {
  const target = await resource();
  const results = await Promise.allSettled([
    reserve(target.id),
    block(target.id),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    await db.resourceOccupancy.count({ where: { resourceId: target.id } }),
    1,
  );
});

test('half-open ranges permit adjacency while buffered occupied time rejects overlap', async () => {
  const target = await resource();
  const bufferedEnd = new Date('2030-01-01T11:15:00Z');
  await reserve(target.id, actorId, start, end, start, bufferedEnd);
  await assert.rejects(
    reserve(target.id, actorId, end, new Date('2030-01-01T12:00:00Z')),
    /ResourceOccupancy_no_overlap/,
  );
  await reserve(
    target.id,
    actorId,
    bufferedEnd,
    new Date('2030-01-01T12:15:00Z'),
  );
  assert.equal(
    await db.resourceOccupancy.count({ where: { resourceId: target.id } }),
    2,
  );
});

test('sources cannot commit without a covering ledger entry or use a different resource', async () => {
  const a = await resource();
  const b = await resource();
  await assert.rejects(
    db.booking.create({ data: bookingData(a.id) }),
    /Occupancy must cover/,
  );
  await assert.rejects(
    db.$transaction(async (tx) => {
      const booking = await tx.booking.create({ data: bookingData(a.id) });
      await tx.resourceOccupancy.create({
        data: {
          resourceId: b.id,
          bookingId: booking.id,
          occupiedStart: start,
          occupiedEnd: end,
        },
      });
    }),
  );
  await assert.rejects(
    reserve(a.id, actorId, start, end, new Date('2030-01-01T10:15:00Z'), end),
    /Occupancy must cover/,
  );
  assert.equal(await db.booking.count({ where: { resourceId: a.id } }), 0);
});

test('cancellation must release occupancy in the same transaction; a later booking can reuse it', async () => {
  const target = await resource();
  const original = await reserve(target.id);
  await assert.rejects(
    db.booking.update({
      where: { id: original.id },
      data: { cancellationCutoffMinutes: 0 },
    }),
    /snapshots are immutable/,
  );
  await assert.rejects(
    db.booking.update({
      where: { id: original.id },
      data: { status: 'CANCELLED_BY_USER' },
    }),
    /Occupancy must cover/,
  );
  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: original.id },
      data: { status: 'CANCELLED_BY_USER' },
    });
    await tx.resourceOccupancy.update({
      where: { bookingId: original.id },
      data: { active: false },
    });
  });
  await reserve(target.id);
  assert.equal(
    await db.resourceOccupancy.count({
      where: { resourceId: target.id, active: true },
    }),
    1,
  );
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: original.id } }))
      .cancellationCutoffMinutes,
    120,
  );
});

test('invalid ranges, prices and missing offline contact cannot be persisted', async () => {
  const target = await resource();
  await assert.rejects(reserve(target.id, actorId, end, start));
  await assert.rejects(
    db.booking.create({ data: { ...bookingData(target.id), priceMinor: -1n } }),
  );
  await assert.rejects(
    db.booking.create({
      data: { ...bookingData(target.id), origin: 'STAFF', customerId: null },
    }),
  );
  await assert.rejects(
    db.resourceOccupancy.create({
      data: { resourceId: target.id, occupiedStart: start, occupiedEnd: end },
    }),
  );
});

test('audit and outbox rollback with their business transaction; audits are immutable', async () => {
  const entityId = randomUUID();
  const event = eventData();
  await assert.rejects(
    db.$transaction(async (tx) => {
      await audit.record(tx, {
        actorId,
        action: 'TEST',
        entityType: 'TEST',
        entityId,
        requestId: randomUUID(),
      });
      await outbox.enqueue(tx, event);
      throw new Error('INTENTIONAL_ROLLBACK');
    }),
    /INTENTIONAL_ROLLBACK/,
  );
  assert.equal(await db.auditEvent.count({ where: { entityId } }), 0);
  assert.equal(
    await db.outboxEvent.count({ where: { eventKey: event.eventKey } }),
    0,
  );
  const record = await db.$transaction((tx) =>
    audit.record(tx, {
      actorId,
      action: 'TEST',
      entityType: 'TEST',
      entityId,
      requestId: randomUUID(),
      metadata: { decision: 'approved' },
    }),
  );
  await assert.rejects(
    db.auditEvent.update({
      where: { id: record.id },
      data: { action: 'ALTERED' },
    }),
    /append-only/,
  );
  await assert.rejects(
    db.auditEvent.delete({ where: { id: record.id } }),
    /append-only/,
  );
  await assert.rejects(
    db.$transaction((tx) =>
      audit.record(tx, {
        action: 'TEST',
        entityType: 'TEST',
        entityId,
        requestId: randomUUID(),
        metadata: { nested: { phone: 'redacted-test-value' } },
      }),
    ),
    /AUDIT_METADATA_SENSITIVE/,
  );
});

test('concurrent workers acquire a single lease for an event', async () => {
  await db.outboxEvent.create({ data: eventData() });
  const claims = await Promise.all(
    Array.from({ length: 10 }, () => outbox.claim()),
  );
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(claims.find(Boolean)!.attempts, 1);
});

test('expired leases recover and stale workers cannot deliver or acknowledge', async () => {
  const event = await db.outboxEvent.create({ data: eventData() });
  const oldLease = (await outbox.claim())!;
  await db.outboxEvent.update({
    where: { id: event.id },
    data: { leaseUntil: new Date(Date.now() - 1000) },
  });
  const newLease = (await outbox.claim())!;
  assert.notEqual(newLease.leaseToken, oldLease.leaseToken);
  assert.equal(newLease.attempts, 2);
  assert.equal(await outbox.deliverInbox(oldLease), false);
  assert.equal((await outbox.fail(oldLease)).count, 0);
  assert.equal(await outbox.deliverInbox(newLease), true);
  assert.equal(await outbox.deliverInbox(newLease), false);
  assert.equal(
    await db.notification.count({ where: { deliveryKey: event.eventKey } }),
    1,
  );
  assert.equal(
    (await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } }))
      .status,
    'DELIVERED',
  );
});

test('failed attempts back off and later retry; unsupported channels never report success', async () => {
  const event = await db.outboxEvent.create({ data: eventData() });
  const lease = (await outbox.claim())!;
  await outbox.fail(lease, 'exception-with-private-content');
  const pending = await db.outboxEvent.findUniqueOrThrow({
    where: { id: event.id },
  });
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.lastErrorCode, 'DELIVERY_FAILED');
  assert.ok(pending.availableAt.getTime() > Date.now());
  assert.equal(await outbox.claim(), undefined);
  await db.outboxEvent.update({
    where: { id: event.id },
    data: { availableAt: new Date(0) },
  });
  await outbox.tick();
  assert.equal(
    await db.notification.count({ where: { deliveryKey: event.eventKey } }),
    1,
  );
  const sms = await db.outboxEvent.create({ data: eventData('SMS') });
  await outbox.tick();
  const failed = await db.outboxEvent.findUniqueOrThrow({
    where: { id: sms.id },
  });
  assert.equal(failed.status, 'PENDING');
  assert.equal(failed.lastErrorCode, 'DELIVERY_ADAPTER_UNAVAILABLE');
  assert.equal(failed.deliveredAt, null);
});

test('exhausted attempts and a crash on the final attempt become dead letters', async () => {
  const first = await db.outboxEvent.create({
    data: { ...eventData(), attempts: MAX_ATTEMPTS - 1 },
  });
  await outbox.fail((await outbox.claim())!);
  assert.equal(
    (await db.outboxEvent.findUniqueOrThrow({ where: { id: first.id } }))
      .status,
    'DEAD',
  );
  const crashed = await db.outboxEvent.create({
    data: { ...eventData(), attempts: MAX_ATTEMPTS - 1 },
  });
  await outbox.claim();
  await db.outboxEvent.update({
    where: { id: crashed.id },
    data: { leaseUntil: new Date(0) },
  });
  assert.equal(await outbox.claim(), undefined);
  assert.equal(
    (await db.outboxEvent.findUniqueOrThrow({ where: { id: crashed.id } }))
      .status,
    'DEAD',
  );
});

test('idempotency keys are scoped to actor and operation and email uniqueness ignores case', async () => {
  const email = `${randomUUID()}@example.test`;
  const other = await db.user.create({
    data: { email, displayName: 'Other', passwordHash: 'test-only' },
  });
  await assert.rejects(
    db.user.create({
      data: {
        email: email.toUpperCase(),
        displayName: 'Duplicate',
        passwordHash: 'test-only',
      },
    }),
  );
  const input = {
    actorId,
    operation: 'booking.create',
    key: randomUUID(),
    requestHash: 'a'.repeat(64),
    response: { id: randomUUID() } as Prisma.InputJsonObject,
    statusCode: 201,
    expiresAt: new Date(Date.now() + 60000),
  };
  await db.idempotencyRecord.create({ data: input });
  await assert.rejects(
    db.idempotencyRecord.create({
      data: { ...input, requestHash: 'b'.repeat(64) },
    }),
  );
  await db.idempotencyRecord.create({ data: { ...input, actorId: other.id } });
  await db.idempotencyRecord.create({
    data: { ...input, operation: 'block.create' },
  });
});

test(
  'the separate worker process delivers inbox events and shuts down',
  { timeout: 20000 },
  async () => {
    const event = await db.outboxEvent.create({ data: eventData() });
    const worker = spawn(process.execPath, ['dist/src/worker.js'], {
      env: process.env,
      stdio: 'ignore',
    });
    const exited = once(worker, 'exit');
    try {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const current = await db.outboxEvent.findUniqueOrThrow({
          where: { id: event.id },
        });
        if (current.status === 'DELIVERED') break;
        if (worker.exitCode !== null || worker.signalCode !== null)
          throw new Error('Worker exited before delivery');
        await delay(100);
      }
      assert.equal(
        (await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } }))
          .status,
        'DELIVERED',
      );
      assert.equal(
        await db.notification.count({ where: { deliveryKey: event.eventKey } }),
        1,
      );
    } finally {
      worker.kill('SIGTERM');
      const timer = setTimeout(() => worker.kill('SIGKILL'), 5000);
      try {
        const [code, signal] = await exited;
        assert.ok(
          code === 0 || signal === 'SIGTERM',
          'Worker must shut down without being force-killed',
        );
      } finally {
        clearTimeout(timer);
      }
    }
  },
);
