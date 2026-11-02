import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OwnerProfile, Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { Principal } from '../identity/auth.service';
import { AuthError } from '../identity/auth.errors';
import { SecurityKeys } from '../identity/security-keys';
import { OutboxService } from '../outbox/outbox.service';
import { BusinessReviewDto, BusinessSubmissionDto } from './businesses.dto';
const visible = (business: OwnerProfile) => ({
  id: business.id,
  legalName: business.legalName,
  status: business.status,
  reviewReason: business.reviewReason,
  createdAt: business.createdAt.toISOString(),
});
@Injectable()
export class BusinessesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly keys: SecurityKeys,
    private readonly outbox: OutboxService,
  ) {}
  private verified(principal: Principal) {
    if (!principal.user.emailVerifiedAt)
      throw new AuthError('EMAIL_VERIFICATION_REQUIRED');
  }
  private admin(principal: Principal) {
    this.verified(principal);
    if (!principal.roles.includes('ADMIN') || !principal.session.mfaVerifiedAt)
      throw new ForbiddenException();
  }
  async list(principal: Principal, cursor?: string, review = false) {
    if (review) this.admin(principal);
    const where: Prisma.OwnerProfileWhereInput = {
      deletedAt: null,
      ...(review
        ? { status: 'PENDING' }
        : { memberships: { some: { userId: principal.user.id } } }),
      ...(cursor ? { id: { gt: cursor } } : {}),
    };
    const rows = await this.db.ownerProfile.findMany({
      where,
      orderBy: { id: 'asc' },
      take: 26,
    });
    const page = rows.slice(0, 25);
    return {
      items: page.map(visible),
      nextCursor: rows.length > 25 ? page.at(-1)!.id : null,
    };
  }
  async submit(
    principal: Principal,
    body: BusinessSubmissionDto,
    requestId: string,
    id?: string,
  ) {
    this.verified(principal);
    return this.db.$transaction(async (tx) => {
      // One pending application per applicant. Serialize concurrent submissions.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${principal.user.id}::uuid FOR UPDATE`;
      if (id) {
        await tx.$queryRaw`SELECT "id" FROM "OwnerProfile" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const old = await tx.ownerProfile.findFirst({
          where: {
            id,
            deletedAt: null,
            memberships: { some: { userId: principal.user.id } },
          },
        });
        if (!old) throw new NotFoundException();
        if (!['DRAFT', 'REJECTED'].includes(old.status))
          throw new ConflictException();
      }
      const pending = await tx.ownerProfile.findFirst({
        where: {
          status: 'PENDING',
          deletedAt: null,
          memberships: { some: { userId: principal.user.id } },
        },
      });
      if (pending) throw new ConflictException();
      const data = {
        legalName: body.legalName,
        evidenceCiphertext: this.keys.encrypt(
          { evidence: body.evidence },
          'owner-evidence',
        ),
        status: 'PENDING' as const,
        reviewReason: null,
      };
      const business = id
        ? await tx.ownerProfile.update({ where: { id }, data })
        : await tx.ownerProfile.create({
            data: {
              ...data,
              memberships: { create: { userId: principal.user.id } },
            },
          });
      await this.audit.record(tx, {
        actorId: principal.user.id,
        action: 'BUSINESS_SUBMITTED',
        entityType: 'OwnerProfile',
        entityId: business.id,
        requestId,
      });
      return visible(business);
    });
  }
  async evidence(principal: Principal, id: string, requestId: string) {
    this.admin(principal);
    return this.db.$transaction(async (tx) => {
      const business = await tx.ownerProfile.findFirst({
        where: { id, deletedAt: null },
      });
      if (!business) throw new NotFoundException();
      await this.audit.record(tx, {
        actorId: principal.user.id,
        action: 'BUSINESS_EVIDENCE_VIEWED',
        entityType: 'OwnerProfile',
        entityId: id,
        requestId,
      });
      return {
        evidence: business.evidenceCiphertext
          ? this.keys.decrypt<{ evidence: string }>(
              business.evidenceCiphertext,
              'owner-evidence',
            ).evidence
          : '',
      };
    });
  }
  async review(
    principal: Principal,
    id: string,
    body: BusinessReviewDto,
    requestId: string,
  ) {
    this.admin(principal);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OwnerProfile" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const business = await tx.ownerProfile.findFirst({
        where: { id, deletedAt: null },
        include: { memberships: true },
      });
      if (!business) throw new NotFoundException();
      if (
        business.memberships.some(
          (member) => member.userId === principal.user.id,
        )
      )
        throw new ForbiddenException();
      if (business.status !== 'PENDING' || !business.evidenceCiphertext)
        throw new ConflictException();
      const updated = await tx.ownerProfile.update({
        where: { id },
        data: { status: body.decision, reviewReason: body.reason },
      });
      const event = await this.audit.record(tx, {
        actorId: principal.user.id,
        action: 'BUSINESS_REVIEWED',
        entityType: 'OwnerProfile',
        entityId: id,
        requestId,
        metadata: {
          decision: body.decision,
          reasonEnvelope: this.keys.encrypt(
            { reason: body.reason },
            'owner-evidence',
          ),
        },
      });
      for (const member of business.memberships)
        await this.outbox.enqueue(tx, {
          eventKey: `${event.id}:${member.userId}`,
          recipientId: member.userId,
          channel: 'IN_APP',
          type: 'BUSINESS_REVIEWED',
          payload: { businessId: id, decision: body.decision },
        });
      return visible(updated);
    });
  }
}
