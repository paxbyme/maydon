import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { Principal } from '../identity/auth.service';
import { AuthError } from '../identity/auth.errors';
import { FacilityCreateDto, FacilityUpdateDto } from './facilities.dto';
type FacilityWithTranslations = Prisma.FacilityGetPayload<{
  include: { translations: true };
}>;
const visible = (f: FacilityWithTranslations) => ({
  id: f.id,
  ownerId: f.ownerId,
  city: f.city,
  timezone: f.timezone,
  address: f.address,
  latitude: f.latitude?.toNumber() ?? null,
  longitude: f.longitude?.toNumber() ?? null,
  status: f.status,
  reviewReason: f.reviewReason,
  revision: f.revision,
  translations: f.translations
    .map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    }))
    .sort((a, b) => a.locale.localeCompare(b.locale)),
});
@Injectable()
export class FacilitiesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}
  private async owner(
    tx: Prisma.TransactionClient,
    principal: Principal,
    ownerId: string,
    write = false,
  ) {
    const business = await tx.ownerProfile.findFirst({
      where: {
        id: ownerId,
        deletedAt: null,
        memberships: { some: { userId: principal.user.id } },
      },
    });
    if (!business) throw new NotFoundException();
    if (write) {
      if (!principal.user.emailVerifiedAt)
        throw new AuthError('EMAIL_VERIFICATION_REQUIRED');
      if (business.status !== 'APPROVED') throw new ForbiddenException();
    }
    return business;
  }
  async list(principal: Principal, ownerId: string, cursor?: string) {
    const business = await this.owner(this.db, principal, ownerId);
    const rows = await this.db.facility.findMany({
      where: {
        ownerId,
        deletedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      include: { translations: true },
      orderBy: { id: 'asc' },
      take: 26,
    });
    return {
      canEdit:
        business.status === 'APPROVED' && !!principal.user.emailVerifiedAt,
      items: rows.slice(0, 25).map(visible),
      nextCursor: rows.length > 25 ? rows[24]!.id : null,
    };
  }
  async create(
    principal: Principal,
    ownerId: string,
    body: FacilityCreateDto,
    requestId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OwnerProfile" WHERE "id" = ${ownerId}::uuid FOR UPDATE`;
      await this.owner(tx, principal, ownerId, true);
      const facility = await tx.facility.create({
        data: {
          ownerId,
          city: 'Namangan',
          timezone: 'Asia/Tashkent',
          address: body.address,
          latitude: body.latitude,
          longitude: body.longitude,
          translations: { create: body.translations },
        },
        include: { translations: true },
      });
      await this.audit.record(tx, {
        actorId: principal.user.id,
        action: 'FACILITY_CREATED',
        entityType: 'Facility',
        entityId: facility.id,
        requestId,
        metadata: { ownerId },
      });
      return visible(facility);
    });
  }
  async update(
    principal: Principal,
    ownerId: string,
    id: string,
    body: FacilityUpdateDto,
    requestId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OwnerProfile" WHERE "id" = ${ownerId}::uuid FOR UPDATE`;
      await this.owner(tx, principal, ownerId, true);
      await tx.$queryRaw`SELECT "id" FROM "Facility" WHERE "id" = ${id}::uuid AND "ownerId" = ${ownerId}::uuid FOR UPDATE`;
      const old = await tx.facility.findFirst({
        where: { id, ownerId, deletedAt: null },
      });
      if (!old) throw new NotFoundException();
      // Published/pending facilities need a reviewed amendment workflow. Never
      // silently change the location of a venue with reservations.
      if (
        !['DRAFT', 'REJECTED'].includes(old.status) ||
        old.revision !== body.expectedRevision
      )
        throw new ConflictException();
      const facility = await tx.facility.update({
        where: { id },
        data: {
          address: body.address,
          latitude: body.latitude,
          longitude: body.longitude,
          status: 'DRAFT',
          reviewReason: null,
          revision: { increment: 1 },
          translations: { deleteMany: {}, create: body.translations },
        },
        include: { translations: true },
      });
      await this.audit.record(tx, {
        actorId: principal.user.id,
        action: 'FACILITY_UPDATED',
        entityType: 'Facility',
        entityId: id,
        requestId,
        metadata: { ownerId, revision: facility.revision },
      });
      return visible(facility);
    });
  }
}
