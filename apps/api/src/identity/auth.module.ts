import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { SecurityKeysModule } from './security-keys';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccessGuard } from './auth.guard';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    OutboxModule,
    SecurityKeysModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RateLimitService,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
