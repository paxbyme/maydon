import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret(): string {
  let bits = 0;
  let value = 0;
  let result = '';
  for (const byte of randomBytes(20)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return result;
}
export function totpAt(secret: string, step: number, digits = 6): string {
  if (!/^[A-Z2-7]+$/.test(secret) || !Number.isSafeInteger(step) || step < 0)
    throw new Error('INVALID_TOTP_INPUT');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of secret) {
    value = (value << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = hash[hash.length - 1]! & 15;
  return String(
    (hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits,
  ).padStart(digits, '0');
}
export function acceptedTotpStep(
  secret: string,
  code: string,
  lastStep: number | null,
  now = Date.now(),
): number | undefined {
  if (!/^\d{6}$/.test(code)) return undefined;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) {
    if (
      step > (lastStep ?? -1) &&
      timingSafeEqual(Buffer.from(totpAt(secret, step)), Buffer.from(code))
    )
      return step;
  }
  return undefined;
}
