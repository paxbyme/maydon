import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LocalDeliveryModule } from '../delivery/local-delivery';
import { OutboxService } from './outbox.service';

@Module({
  imports: [DatabaseModule, LocalDeliveryModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
