import {
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { createClient } from 'redis';
import { SecurityKeys } from './security-keys';

export class RateLimitException extends HttpException {
  constructor(readonly retryAfter: number) {
    super('Request rate limit exceeded', 429);
  }
}

@Injectable()
export class RateLimitService implements OnApplicationShutdown {
  private readonly client = createClient({
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    socket: { connectTimeout: 2000, reconnectStrategy: false },
  });
  private connecting?: Promise<unknown>;
  constructor(private readonly keys: SecurityKeys) {
    this.client.on('error', () => {});
  }
  async consume(
    scope: string,
    subject: string,
    limit: number,
    windowMs: number,
  ) {
    try {
      if (!this.client.isReady) {
        this.connecting ??= this.client.connect().finally(() => {
          this.connecting = undefined;
        });
        await this.connecting;
      }
      const key = `maydon:rate:${scope}:${this.keys.throttleKey(subject)}`;
      const result = (await this.client.eval(
        `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
        return {count, redis.call('PTTL', KEYS[1])}
      `,
        { keys: [key], arguments: [String(windowMs)] },
      )) as number[];
      if (Number(result[0]) > limit)
        throw new RateLimitException(
          Math.max(1, Math.ceil(Number(result[1]) / 1000)),
        );
    } catch (error) {
      if (error instanceof RateLimitException) throw error;
      throw new ServiceUnavailableException(
        'Authentication temporarily unavailable',
      );
    }
  }
  async onApplicationShutdown() {
    if (this.client.isOpen)
      await this.client.quit().catch(() => this.client.destroy());
  }
}
