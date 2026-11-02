import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import {
  BusinessesController,
  BusinessReviewController,
} from './businesses.controller';
import { BusinessesService } from './businesses.service';
@Module({
  imports: [AuditModule, OutboxModule],
  controllers: [BusinessesController, BusinessReviewController],
  providers: [BusinessesService],
})
export class BusinessesModule {}
