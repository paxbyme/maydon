import { Injectable, Module } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  SecurityKeys,
  SecurityKeysModule,
  digest,
} from '../identity/security-keys';

export interface VerificationMessage {
  channel: 'EMAIL' | 'SMS';
  to: string;
  challengeId: string;
  code: string;
  expiresAt: string;
}

@Injectable()
export class LocalDeliveryAdapter {
  constructor(private readonly keys: SecurityKeys) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Local delivery is forbidden in production');
  }
  async deliver(eventKey: string, envelope: string): Promise<void> {
    if (process.env.DELIVERY_ADAPTER !== 'local')
      throw new Error('DELIVERY_ADAPTER_UNAVAILABLE');
    const message = this.keys.decrypt<VerificationMessage>(envelope);
    if (
      !['EMAIL', 'SMS'].includes(message.channel) ||
      !/^\d{6}$/.test(message.code) ||
      !message.to ||
      !message.challengeId
    ) {
      throw new Error('INVALID_DELIVERY_MESSAGE');
    }
    if (
      !Number.isFinite(Date.parse(message.expiresAt)) ||
      Date.parse(message.expiresAt) <= Date.now()
    )
      throw new Error('MESSAGE_EXPIRED');
    const directory = resolve(
      process.env.DEV_DELIVERY_DIR ?? '.cache/dev-delivery',
    );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(
        resolve(directory, `${digest(eventKey)}.json`),
        JSON.stringify({ adapter: 'LOCAL_TEST_ONLY', ...message }, null, 2),
        { mode: 0o600, flag: 'wx' },
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}

@Module({
  imports: [SecurityKeysModule],
  providers: [LocalDeliveryAdapter],
  exports: [LocalDeliveryAdapter],
})
export class LocalDeliveryModule {}
