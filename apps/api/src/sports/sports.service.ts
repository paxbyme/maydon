import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Locale } from '@prisma/client';
import { DatabaseService } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { Principal } from '../identity/auth.service';
import { SportCreateDto, SportUpdateDto } from './sports.dto';
type Row = Prisma.SportGetPayload<{ include: { translations: true } }>;
const visible = (row: Row) => ({
  id: row.id,
  slug: row.slug,
  active: row.active,
  revision: row.revision,
  translations: row.translations
    .map((t) => ({ locale: t.locale, name: t.name }))
    .sort((a, b) => a.locale.localeCompare(b.locale)),
});
@Injectable()
export class SportsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}
  private admin(principal: Principal) {
    if (
      !principal.user.emailVerifiedAt ||
      !principal.roles.includes('ADMIN') ||
      !principal.session.mfaVerifiedAt
    )
      throw new ForbiddenException();
  }
  async list(cursor?: string, principal?: Principal) {
    if (principal) this.admin(principal);
    const rows = await this.db.sport.findMany({
      where: {
        ...(principal
          ? {}
          : {
              active: true,
              AND: Object.values(Locale).map((locale) => ({
                translations: { some: { locale, name: { not: '' } } },
              })),
            }),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      include: { translations: true },
      orderBy: { id: 'asc' },
      take: 26,
    });
    return {
      items: rows.slice(0, 25).map(visible),
      nextCursor: rows.length > 25 ? rows[24]!.id : null,
    };
  }
  async create(principal: Principal, body: SportCreateDto, requestId: string) {
    this.admin(principal);
    return this.db.$transaction(async (tx) => {
      const sport = await tx.sport.create({
        data: {
          slug: body.slug,
          active: body.active,
          translations: { create: body.translations },
        },
        include: { translations: true },
      });
      await this.audit.record(tx, {
        actorId: principal.user.id,
        action: 'SPORT_CREATED',
        entityType: 'Sport',
        entityId: sport.id,
        requestId,
        metadata: { active: sport.active },
      });
      return visible(sport);
    });
  }
  async update(
    principal: Principal,
    id: string,
    body: SportUpdateDto,
    requestId: string,
  ) {
    this.admin(principal);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Sport" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const old = await tx.sport.findUnique({ where: { id } });
      if (!old) throw new NotFoundException();
      if (old.revision !== body.expectedRevision) throw new ConflictException();
      const sport = await tx.sport.update({
        where: { id },
        data: {
          active: body.active,
          revision: { increment: 1 },
          translations: { deleteMany: {}, create: body.translations },
        },
        include: { translations: true },
      });
      await this.audit.record(tx, {
        actorId: principal.user.id,
        action: 'SPORT_UPDATED',
        entityType: 'Sport',
        entityId: id,
        requestId,
        metadata: { active: sport.active, revision: sport.revision },
      });
      return visible(sport);
    });
  }
}
