import { Injectable } from '@nestjs/common';
import { Prisma, StaffPreset } from '@prisma/client';
import { DatabaseService } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { AuthError } from '../identity/auth.errors';

export type ResourcePermission =
  | 'view'
  | 'configure'
  | 'book'
  | 'cancel'
  | 'attendance'
  | 'statistics'
  | 'contact'
  | 'staff';
const permissions: Record<StaffPreset, readonly ResourcePermission[]> = {
  MANAGER: [
    'view',
    'configure',
    'book',
    'cancel',
    'attendance',
    'statistics',
    'contact',
  ],
  BOOKING_CLERK: ['view', 'book', 'cancel', 'attendance', 'contact'],
  VIEWER: ['view', 'statistics'],
};
@Injectable()
export class ResourceAccessService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}
  async require(
    userId: string,
    resourceId: string,
    permission: ResourcePermission,
    tx: Prisma.TransactionClient = this.db,
  ) {
    const resource = await tx.bookableResource.findFirst({
      where: {
        id: resourceId,
        deletedAt: null,
        facility: { deletedAt: null, owner: { deletedAt: null } },
      },
      select: { facility: { select: { ownerId: true } } },
    });
    if (!resource) throw new AuthError('RESOURCE_SCOPE_DENIED');
    const owner = await tx.ownerMembership.findUnique({
      where: { ownerId_userId: { ownerId: resource.facility.ownerId, userId } },
    });
    if (owner) return;
    const staff = await tx.staffAssignment.findUnique({
      where: { userId_resourceId: { userId, resourceId } },
    });
    if (!staff || !permissions[staff.preset].includes(permission))
      throw new AuthError('RESOURCE_SCOPE_DENIED');
  }
  async assign(
    actorId: string,
    resourceId: string,
    userId: string,
    preset: StaffPreset,
    requestId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "BookableResource" WHERE "id" = ${resourceId}::uuid FOR UPDATE`;
      await this.require(actorId, resourceId, 'staff', tx);
      const target = await tx.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
          disabledAt: null,
          emailVerifiedAt: { not: null },
        },
        select: { id: true },
      });
      if (!target) throw new AuthError('RESOURCE_SCOPE_DENIED');
      const assignment = await tx.staffAssignment.upsert({
        where: { userId_resourceId: { userId, resourceId } },
        create: { userId, resourceId, preset, grantedById: actorId },
        update: { preset, grantedById: actorId },
      });
      await this.audit.record(tx, {
        actorId,
        action: 'STAFF_ASSIGNED',
        entityType: 'BookableResource',
        entityId: resourceId,
        requestId,
        metadata: { userId, preset },
      });
      return {
        userId: assignment.userId,
        resourceId: assignment.resourceId,
        preset: assignment.preset,
      };
    });
  }
  async revoke(
    actorId: string,
    resourceId: string,
    userId: string,
    requestId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "BookableResource" WHERE "id" = ${resourceId}::uuid FOR UPDATE`;
      await this.require(actorId, resourceId, 'staff', tx);
      await tx.staffAssignment.deleteMany({ where: { userId, resourceId } });
      await this.audit.record(tx, {
        actorId,
        action: 'STAFF_REVOKED',
        entityType: 'BookableResource',
        entityId: resourceId,
        requestId,
        metadata: { userId },
      });
      return { revoked: true };
    });
  }
}
