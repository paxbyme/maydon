import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ResourceAccessService } from './resource-access.service';
import { StaffController } from './staff.controller';
@Module({
  imports: [AuditModule],
  providers: [ResourceAccessService],
  controllers: [StaffController],
  exports: [ResourceAccessService],
})
export class ResourceAccessModule {}
