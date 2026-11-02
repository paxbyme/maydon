import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SportsController, SportsAdminController } from './sports.controller';
import { SportsService } from './sports.service';
@Module({
  imports: [AuditModule],
  controllers: [SportsController, SportsAdminController],
  providers: [SportsService],
})
export class SportsModule {}
