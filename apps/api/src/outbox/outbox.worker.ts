import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private stopping = false;
  private task?: Promise<void>;
  private wake?: () => void;
  constructor(private readonly outbox: OutboxService) {}

  onApplicationBootstrap() {
    this.task = this.run();
  }

  private async run() {
    while (!this.stopping) {
      try {
        if (await this.outbox.tick()) continue;
      } catch {
        this.logger.warn('OUTBOX_POLL_FAILED');
      }
      if (this.stopping) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        this.wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.wake = undefined;
    }
  }

  async onModuleDestroy() {
    this.stopping = true;
    this.wake?.();
    await this.task;
  }
}
