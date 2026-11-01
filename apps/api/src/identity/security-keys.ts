import { Global, Injectable, Module } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function equalDigest(a: string, b: string): boolean {
  return (
    /^[a-f0-9]{64}$/.test(a) &&
    /^[a-f0-9]{64}$/.test(b) &&
    timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  );
}

@Injectable()
export class SecurityKeys {
  private readonly secret: string;
  readonly allowedOrigins: string[];
  constructor() {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32 || secret.startsWith('replace-'))
      throw new Error(
        'AUTH_SECRET must be configured with at least 32 random characters',
      );
    this.secret = secret;
    this.allowedOrigins = (
      process.env.WEB_ORIGINS ??
      'http://localhost:5173,http://localhost:5174,http://localhost:5175'
    )
      .split(',')
      .map((value) => value.trim());
    for (const value of this.allowedOrigins) {
      const url = new URL(value);
      if (url.origin !== value || !['https:', 'http:'].includes(url.protocol))
        throw new Error('WEB_ORIGINS must contain exact HTTP(S) origins');
    }
  }
  key(purpose: string) {
    return Buffer.from(
      hkdfSync('sha256', this.secret, 'maydon-v1', purpose, 32),
    );
  }
  jwtKey() {
    return this.key('access-token');
  }
  hashOtp(id: string, code: string) {
    return createHmac('sha256', this.key('verification-code'))
      .update(`${id}:${code}`)
      .digest('hex');
  }
  throttleKey(value: string) {
    return createHmac('sha256', this.key('rate-limit'))
      .update(value)
      .digest('hex');
  }
  encrypt(
    value: unknown,
    purpose: 'verification' | 'mfa' = 'verification',
  ): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.key(`private-envelope-${purpose}`),
      nonce,
    );
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      nonce.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }
  decrypt<T>(
    envelope: string,
    purpose: 'verification' | 'mfa' = 'verification',
  ): T {
    const [version, nonce, tag, ciphertext, extra] = envelope.split('.');
    if (version !== 'v1' || !nonce || !tag || !ciphertext || extra)
      throw new Error('INVALID_PRIVATE_ENVELOPE');
    const iv = Buffer.from(nonce, 'base64url');
    const authTag = Buffer.from(tag, 'base64url');
    if (iv.length !== 12 || authTag.length !== 16)
      throw new Error('INVALID_PRIVATE_ENVELOPE');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(`private-envelope-${purpose}`),
      iv,
    );
    decipher.setAuthTag(authTag);
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8'),
    ) as T;
  }
}

@Global()
@Module({ providers: [SecurityKeys], exports: [SecurityKeys] })
export class SecurityKeysModule {}
