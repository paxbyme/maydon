import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ChallengePurpose,
  Locale,
  Prisma,
  Session,
  User,
} from '@prisma/client';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { DatabaseService } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { RateLimitService } from './rate-limit.service';
import { SecurityKeys, digest, equalDigest } from './security-keys';
import { AuthError } from './auth.errors';
import { acceptedTotpStep, newTotpSecret } from './totp';

const passwordOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
} as const;
const lifetime = 30 * 24 * 60 * 60 * 1000;
export const genericDeliveryResponse = { accepted: true };
export interface AuthContext {
  ip: string;
  requestId: string;
  origin?: string;
  csrf?: string;
  web: boolean;
}
export interface Principal {
  user: User;
  session: Session;
  roles: string[];
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    emailVerified: !!user.emailVerifiedAt,
    phone: user.phone,
    phoneVerified: !!user.phoneVerifiedAt,
    mfaEnabled: !!user.mfaEnabledAt,
  };
}

@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash(randomBytes(32), passwordOptions);
  constructor(
    private readonly db: DatabaseService,
    private readonly keys: SecurityKeys,
    private readonly rate: RateLimitService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  private checkClient(context: AuthContext) {
    if (context.web) {
      if (!context.origin || !this.keys.allowedOrigins.includes(context.origin))
        throw new ForbiddenException();
    } else if (context.origin) throw new ForbiddenException();
  }
  private async lockUser(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }
  private async challenge(
    tx: Prisma.TransactionClient,
    user: User,
    purpose: ChallengePurpose,
    target: string,
  ) {
    const id = randomUUID();
    const code = String(randomInt(1000000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await tx.verificationChallenge.updateMany({
      where: { userId: user.id, purpose, consumedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.verificationChallenge.create({
      data: {
        id,
        userId: user.id,
        purpose,
        target,
        codeHash: this.keys.hashOtp(id, code),
        expiresAt,
      },
    });
    const channel = purpose === 'VERIFY_PHONE' ? 'SMS' : 'EMAIL';
    await this.outbox.enqueue(tx, {
      eventKey: `challenge:${id}`,
      recipientId: user.id,
      channel,
      type: purpose,
      payload: {
        envelope: this.keys.encrypt({
          channel,
          to: target,
          challengeId: id,
          code,
          expiresAt: expiresAt.toISOString(),
        }),
      },
    });
  }

  async register(
    input: {
      email: string;
      password: string;
      displayName: string;
      locale?: Locale;
    },
    context: AuthContext,
  ) {
    const email = input.email.trim().toLowerCase();
    await this.rate.consume('register-ip', context.ip, 5, 3600000);
    await this.rate.consume('register-email', email, 3, 3600000);
    const passwordHash = await argon2.hash(input.password, passwordOptions);
    try {
      await this.db.$transaction(async (tx) => {
        if (await tx.user.findUnique({ where: { email } })) return;
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName: input.displayName,
            locale: input.locale ?? 'uz',
            roles: { create: { role: 'PLAYER' } },
          },
        });
        await this.challenge(tx, user, 'VERIFY_EMAIL', email);
        await this.audit.record(tx, {
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: user.id,
          requestId: context.requestId,
        });
      });
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      )
        throw error;
    }
    return genericDeliveryResponse;
  }

  async requestEmail(
    emailInput: string,
    purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
    context: AuthContext,
  ) {
    const email = emailInput.trim().toLowerCase();
    await this.rate.consume('email-ip', context.ip, 20, 3600000);
    await this.rate.consume(`email-resend-${purpose}`, email, 1, 60000);
    await this.rate.consume(`email-daily-${purpose}`, email, 5, 86400000);
    const user = await this.db.user.findUnique({ where: { email } });
    if (
      user &&
      !user.deletedAt &&
      !user.disabledAt &&
      !(purpose === 'VERIFY_EMAIL' && user.emailVerifiedAt)
    ) {
      await this.db.$transaction(async (tx) => {
        await this.lockUser(tx, user.id);
        const current = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
        });
        if (
          current.deletedAt ||
          current.disabledAt ||
          (purpose === 'VERIFY_EMAIL' && current.emailVerifiedAt)
        )
          return;
        await this.challenge(tx, current, purpose, email);
      });
    }
    return genericDeliveryResponse;
  }

  async requestPhone(
    principal: Principal,
    phone: string,
    context: AuthContext,
  ) {
    if (!principal.user.emailVerifiedAt)
      throw new AuthError('EMAIL_VERIFICATION_REQUIRED');
    await this.rate.consume('sms-user', principal.user.id, 3, 3600000);
    await this.rate.consume('sms-resend', principal.user.id, 1, 60000);
    await this.rate.consume('sms-target', phone, 5, 86400000);
    await this.db.$transaction(async (tx) => {
      await this.lockUser(tx, principal.user.id);
      const current = await tx.user.findUniqueOrThrow({
        where: { id: principal.user.id },
      });
      await this.challenge(tx, current, 'VERIFY_PHONE', phone);
    });
    return genericDeliveryResponse;
  }

  private async consumeChallenge(
    purpose: ChallengePurpose,
    id: string,
    code: string,
    context: AuthContext,
    apply: (
      tx: Prisma.TransactionClient,
      user: User,
      target: string,
    ) => Promise<void>,
    actorId?: string,
  ) {
    await this.rate.consume('verify-ip', context.ip, 30, 60000);
    const original = await this.db.verificationChallenge.findUnique({
      where: { id },
    });
    if (!original || (actorId && original.userId !== actorId))
      throw new AuthError('INVALID_CHALLENGE', 400);
    const valid = await this.db.$transaction(async (tx) => {
      await this.lockUser(tx, original.userId);
      await tx.$queryRaw`SELECT "id" FROM "VerificationChallenge" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const challenge = await tx.verificationChallenge.findUniqueOrThrow({
        where: { id },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: challenge.userId },
      });
      if (
        challenge.purpose !== purpose ||
        challenge.consumedAt ||
        challenge.revokedAt ||
        challenge.expiresAt <= new Date() ||
        challenge.attempts >= 5 ||
        user.deletedAt ||
        user.disabledAt
      )
        return false;
      if (!equalDigest(challenge.codeHash, this.keys.hashOtp(id, code))) {
        await tx.verificationChallenge.update({
          where: { id },
          data: { attempts: { increment: 1 } },
        });
        return false;
      }
      await apply(tx, user, challenge.target);
      await tx.verificationChallenge.update({
        where: { id },
        data: { consumedAt: new Date() },
      });
      await this.audit.record(tx, {
        actorId: user.id,
        action: purpose,
        entityType: 'User',
        entityId: user.id,
        requestId: context.requestId,
      });
      return true;
    });
    if (!valid) throw new AuthError('INVALID_CHALLENGE', 400);
    return { verified: true };
  }
  verifyEmail(id: string, code: string, context: AuthContext) {
    return this.consumeChallenge(
      'VERIFY_EMAIL',
      id,
      code,
      context,
      async (tx, user, target) => {
        if (target !== user.email)
          throw new AuthError('INVALID_CHALLENGE', 400);
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      },
    );
  }
  verifyPhone(
    principal: Principal,
    id: string,
    code: string,
    context: AuthContext,
  ) {
    return this.consumeChallenge(
      'VERIFY_PHONE',
      id,
      code,
      context,
      async (tx, user, target) => {
        await tx.user.update({
          where: { id: user.id },
          data: { phone: target, phoneVerifiedAt: new Date() },
        });
      },
      principal.user.id,
    );
  }
  async resetPassword(
    id: string,
    code: string,
    password: string,
    context: AuthContext,
  ) {
    await this.rate.consume('reset-ip', context.ip, 10, 60000);
    const passwordHash = await argon2.hash(password, passwordOptions);
    return this.consumeChallenge(
      'RESET_PASSWORD',
      id,
      code,
      context,
      async (tx, user, target) => {
        if (target !== user.email)
          throw new AuthError('INVALID_CHALLENGE', 400);
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash, mfaPendingCiphertext: null },
        });
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.verificationChallenge.updateMany({
          where: {
            userId: user.id,
            purpose: 'RESET_PASSWORD',
            id: { not: id },
          },
          data: { revokedAt: new Date() },
        });
      },
    );
  }

  private async tokens(
    user: User,
    session: Session,
    refreshToken: string,
    csrf: string | undefined,
    roles: string[],
  ) {
    return {
      accessToken: await this.jwt.signAsync(
        { sub: user.id, sid: session.id, jti: randomUUID(), kind: 'access' },
        {
          secret: this.keys.jwtKey(),
          algorithm: 'HS256',
          issuer: 'maydon',
          audience: 'maydon-api',
          expiresIn: 900,
        },
      ),
      refreshToken,
      csrf,
      expiresIn: 900,
      expiresAt: session.expiresAt,
      mfaRequired:
        (roles.includes('ADMIN') || !!user.mfaEnabledAt) &&
        !session.mfaVerifiedAt,
      user: publicUser(user),
    };
  }
  async login(emailInput: string, password: string, context: AuthContext) {
    this.checkClient(context);
    const email = emailInput.trim().toLowerCase();
    await this.rate.consume('login-ip', context.ip, 30, 60000);
    await this.rate.consume('login-email', email, 10, 60000);
    const original = await this.db.user.findUnique({ where: { email } });
    const correct = await argon2
      .verify(original?.passwordHash ?? (await this.dummyHash), password)
      .catch(() => false);
    if (!correct || !original || original.deletedAt || original.disabledAt)
      throw new UnauthorizedException();
    const refreshToken = randomBytes(32).toString('base64url');
    const csrf = randomBytes(32).toString('base64url');
    const result = await this.db.$transaction(async (tx) => {
      await this.lockUser(tx, original.id);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: original.id },
        include: { roles: true },
      });
      if (
        user.passwordHash !== original.passwordHash ||
        user.deletedAt ||
        user.disabledAt
      )
        throw new UnauthorizedException();
      const now = new Date();
      const session = await tx.session.create({
        data: {
          userId: user.id,
          web: context.web,
          csrfHash: digest(csrf),
          createdAt: now,
          expiresAt: new Date(now.getTime() + lifetime),
          credentials: { create: { tokenHash: digest(refreshToken) } },
        },
      });
      await this.audit.record(tx, {
        actorId: user.id,
        action: 'SESSION_CREATED',
        entityType: 'Session',
        entityId: session.id,
        requestId: context.requestId,
      });
      return { user, session };
    });
    return this.tokens(
      result.user,
      result.session,
      refreshToken,
      context.web ? csrf : undefined,
      result.user.roles.map((role) => role.role),
    );
  }

  async refresh(token: string, context: AuthContext) {
    this.checkClient(context);
    await this.rate.consume('refresh-ip', context.ip, 60, 60000);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedException();
    const original = await this.db.refreshCredential.findUnique({
      where: { tokenHash: digest(token) },
      include: { session: true },
    });
    if (!original) throw new UnauthorizedException();
    const nextToken = randomBytes(32).toString('base64url');
    const result = await this.db.$transaction(async (tx) => {
      await this.lockUser(tx, original.session.userId);
      await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${original.sessionId}::uuid FOR UPDATE`;
      const session = await tx.session.findUniqueOrThrow({
        where: { id: original.sessionId },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: session.userId },
        include: { roles: true },
      });
      if (
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        user.deletedAt ||
        user.disabledAt
      )
        return null;
      if (session.web !== context.web) throw new ForbiddenException();
      if (
        session.web &&
        (!context.csrf || !equalDigest(session.csrfHash, digest(context.csrf)))
      )
        throw new ForbiddenException();
      const credential = await tx.refreshCredential.findUniqueOrThrow({
        where: { id: original.id },
      });
      if (credential.consumedAt) {
        await tx.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        await this.audit.record(tx, {
          actorId: user.id,
          action: 'SESSION_REUSE_DETECTED',
          entityType: 'Session',
          entityId: session.id,
          requestId: context.requestId,
        });
        return null;
      }
      await tx.refreshCredential.update({
        where: { id: credential.id },
        data: { consumedAt: new Date() },
      });
      await tx.refreshCredential.create({
        data: { sessionId: session.id, tokenHash: digest(nextToken) },
      });
      await tx.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });
      return { user, session };
    });
    if (!result) throw new UnauthorizedException();
    return this.tokens(
      result.user,
      result.session,
      nextToken,
      undefined,
      result.user.roles.map((role) => role.role),
    );
  }

  async authenticate(token: string): Promise<Principal> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        sid: string;
        kind: string;
        exp: number;
      }>(token, {
        secret: this.keys.jwtKey(),
        algorithms: ['HS256'],
        issuer: 'maydon',
        audience: 'maydon-api',
      });
      if (
        payload.kind !== 'access' ||
        typeof payload.exp !== 'number' ||
        !/^[0-9a-f-]{36}$/i.test(payload.sub) ||
        !/^[0-9a-f-]{36}$/i.test(payload.sid)
      )
        throw new UnauthorizedException();
      const session = await this.db.session.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { deletedAt: null, disabledAt: null },
        },
        include: { user: { include: { roles: true } } },
      });
      if (!session) throw new UnauthorizedException();
      return {
        session,
        user: session.user,
        roles: session.user.roles.map((role) => role.role),
      };
    } catch {
      throw new UnauthorizedException();
    }
  }

  async logout(principal: Principal, context: AuthContext, all = false) {
    if (principal.session.web) {
      this.checkClient({ ...context, web: true });
      if (
        !context.csrf ||
        !equalDigest(principal.session.csrfHash, digest(context.csrf))
      )
        throw new ForbiddenException();
    }
    await this.db.$transaction(async (tx) => {
      await this.lockUser(tx, principal.user.id);
      await tx.session.updateMany({
        where: {
          userId: principal.user.id,
          ...(all ? {} : { id: principal.session.id }),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, {
        actorId: principal.user.id,
        action: all ? 'SESSIONS_REVOKED' : 'SESSION_REVOKED',
        entityType: 'Session',
        entityId: principal.session.id,
        requestId: context.requestId,
      });
    });
    return { revoked: true };
  }

  profile(principal: Principal) {
    return publicUser(principal.user);
  }
  async updateProfile(
    principal: Principal,
    input: { displayName?: string; locale?: Locale },
  ) {
    return publicUser(
      await this.db.user.update({
        where: { id: principal.user.id },
        data: input,
      }),
    );
  }

  async setupMfa(principal: Principal, password: string, context: AuthContext) {
    if (!principal.user.emailVerifiedAt)
      throw new AuthError('EMAIL_VERIFICATION_REQUIRED');
    await this.rate.consume('mfa-setup', principal.user.id, 5, 3600000);
    if (
      !(await argon2
        .verify(principal.user.passwordHash, password)
        .catch(() => false))
    )
      throw new UnauthorizedException();
    const secret = newTotpSecret();
    await this.db.$transaction(async (tx) => {
      await this.lockUser(tx, principal.user.id);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: principal.user.id },
      });
      if (user.mfaEnabledAt) throw new AuthError('MFA_ALREADY_ENABLED', 409);
      if (user.passwordHash !== principal.user.passwordHash)
        throw new UnauthorizedException();
      await tx.user.update({
        where: { id: user.id },
        data: { mfaPendingCiphertext: this.keys.encrypt({ secret }, 'mfa') },
      });
      await this.audit.record(tx, {
        actorId: user.id,
        action: 'MFA_SETUP_STARTED',
        entityType: 'User',
        entityId: user.id,
        requestId: context.requestId,
      });
    });
    return {
      secret,
      uri: `otpauth://totp/${encodeURIComponent(`MAYDON:${principal.user.email}`)}?secret=${secret}&issuer=MAYDON&algorithm=SHA1&digits=6&period=30`,
    };
  }

  async verifyMfa(
    principal: Principal,
    code: string,
    context: AuthContext,
    enrollment: boolean,
  ) {
    await this.rate.consume('mfa-verify', principal.user.id, 5, 60000);
    await this.db.$transaction(async (tx) => {
      await this.lockUser(tx, principal.user.id);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: principal.user.id },
      });
      const session = await tx.session.findFirst({
        where: {
          id: principal.session.id,
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!session || user.disabledAt || user.deletedAt)
        throw new UnauthorizedException();
      const ciphertext = enrollment
        ? user.mfaPendingCiphertext
        : user.mfaSecretCiphertext;
      if (!ciphertext || (enrollment && user.mfaEnabledAt))
        throw new AuthError('MFA_NOT_CONFIGURED', 400);
      const { secret } = this.keys.decrypt<{ secret: string }>(
        ciphertext,
        'mfa',
      );
      const step = acceptedTotpStep(secret, code, user.mfaLastUsedStep);
      if (step === undefined) throw new AuthError('INVALID_CHALLENGE', 400);
      await tx.user.update({
        where: { id: user.id },
        data: {
          mfaLastUsedStep: step,
          ...(enrollment
            ? {
                mfaSecretCiphertext: ciphertext,
                mfaPendingCiphertext: null,
                mfaEnabledAt: new Date(),
              }
            : {}),
        },
      });
      await tx.session.update({
        where: { id: principal.session.id },
        data: { mfaVerifiedAt: new Date() },
      });
      await this.audit.record(tx, {
        actorId: user.id,
        action: enrollment ? 'MFA_ENABLED' : 'MFA_VERIFIED',
        entityType: 'Session',
        entityId: principal.session.id,
        requestId: context.requestId,
      });
    });
    return { verified: true };
  }
}
