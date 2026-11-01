import { Injectable } from '@nestjs/common';
import { DeliveryChannel, OutboxEvent, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.module';

export const MAX_ATTEMPTS = 8;
export const LEASE_SECONDS = 30;

@Injectable()
export class OutboxService {
  constructor(private readonly db: DatabaseService) {}

  // Caller supplies its business transaction: committing a booking cannot lose its event.
  enqueue(
    tx: Prisma.TransactionClient,
    input: {
      eventKey: string;
      recipientId: string;
      channel: DeliveryChannel;
      type: string;
      payload: Prisma.InputJsonValue;
    },
  ) {
    return tx.outboxEvent.create({ data: input });
  }

  async claim(): Promise<OutboxEvent | undefined> {
    const leaseToken = randomUUID();
    return this.db.$transaction(async (tx) => {
      // Recover workers that died on their final attempt without looping forever.
      await tx.$executeRaw`
        UPDATE "OutboxEvent" SET "status" = 'DEAD', "leaseToken" = NULL, "leaseUntil" = NULL,
          "lastErrorCode" = 'ATTEMPTS_EXHAUSTED'
        WHERE "attempts" >= ${MAX_ATTEMPTS} AND (
          "status" = 'PENDING' OR ("status" = 'PROCESSING' AND "leaseUntil" <= now()))`;
      const events = await tx.$queryRaw<OutboxEvent[]>`
        WITH next_event AS (
          SELECT "id" FROM "OutboxEvent"
          WHERE "attempts" < ${MAX_ATTEMPTS} AND (
            ("status" = 'PENDING' AND "availableAt" <= now()) OR
            ("status" = 'PROCESSING' AND "leaseUntil" <= now()))
          ORDER BY "availableAt", "createdAt", "id"
          FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE "OutboxEvent" AS event SET "status" = 'PROCESSING',
          "attempts" = "attempts" + 1, "leaseToken" = ${leaseToken}::uuid,
          "leaseUntil" = now() + make_interval(secs => ${LEASE_SECONDS})
        FROM next_event WHERE event."id" = next_event."id"
        RETURNING event.*`;
      return events[0];
    });
  }

  async deliverInbox(event: OutboxEvent): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      // Only the current, unexpired lease may commit delivery. A stale worker is fenced out.
      const rows = await tx.$queryRaw<OutboxEvent[]>`
        SELECT * FROM "OutboxEvent" WHERE "id" = ${event.id}::uuid
          AND "leaseToken" = ${event.leaseToken}::uuid AND "status" = 'PROCESSING'
          AND "leaseUntil" > now() FOR UPDATE`;
      const current = rows[0];
      if (!current) return false;
      if (current.channel !== 'IN_APP')
        throw new Error('DELIVERY_ADAPTER_UNAVAILABLE');
      await tx.notification.upsert({
        where: { deliveryKey: current.eventKey },
        create: {
          deliveryKey: current.eventKey,
          userId: current.recipientId,
          type: current.type,
          payload: current.payload as Prisma.InputJsonValue,
        },
        update: {},
      });
      await tx.outboxEvent.update({
        where: { id: current.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: null,
        },
      });
      return true;
    });
  }

  async fail(event: OutboxEvent, code = 'DELIVERY_FAILED') {
    // Codes are allowlisted; never persist exception text or delivery credentials.
    const lastErrorCode =
      code === 'DELIVERY_ADAPTER_UNAVAILABLE' ? code : 'DELIVERY_FAILED';
    const delaySeconds = Math.min(3600, 2 ** event.attempts);
    return this.db.outboxEvent.updateMany({
      where: {
        id: event.id,
        leaseToken: event.leaseToken,
        status: 'PROCESSING',
        leaseUntil: { gt: new Date() },
      },
      data: {
        status: event.attempts >= MAX_ATTEMPTS ? 'DEAD' : 'PENDING',
        availableAt: new Date(Date.now() + delaySeconds * 1000),
        leaseToken: null,
        leaseUntil: null,
        lastErrorCode,
      },
    });
  }

  async tick(): Promise<boolean> {
    const event = await this.claim();
    if (!event) return false;
    try {
      if (event.channel !== 'IN_APP') {
        await this.fail(event, 'DELIVERY_ADAPTER_UNAVAILABLE');
      } else {
        await this.deliverInbox(event);
      }
    } catch {
      await this.fail(event);
    }
    return true;
  }
}
