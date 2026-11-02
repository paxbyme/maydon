import { FacilitiesModule } from './facilities/facilities.module';
import { BusinessesModule } from './businesses/businesses.module';
import { ResourceAccessModule } from './access/resource-access.module';
import { AuthModule } from './identity/auth.module';
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    AuthModule,
    ResourceAccessModule,
    BusinessesModule,
    FacilitiesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
