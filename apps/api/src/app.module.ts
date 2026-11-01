import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [HealthController],
})
export class AppModule {}
