import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptedTotpStep, totpAt } from '../src/identity/totp';
import { SecurityKeys } from '../src/identity/security-keys';
// RFC 6238 Appendix B, SHA-1 test secret and all six reference timestamps.
test('TOTP matches RFC 6238 SHA-1 vectors and rejects replay', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  for (const [seconds, expected] of [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ] as const) {
    assert.equal(totpAt(secret, Math.floor(seconds / 30), 8), expected);
  }
  const step = 100;
  const code = totpAt(secret, step);
  assert.equal(acceptedTotpStep(secret, code, null, step * 30000), step);
  assert.equal(acceptedTotpStep(secret, code, step, step * 30000), undefined);
});
test('private envelopes detect tampering and separate verification/MFA keys', () => {
  process.env.AUTH_SECRET =
    'test-only-secret-never-use-outside-tests-123456789';
  const keys = new SecurityKeys();
  const envelope = keys.encrypt({ code: '123456' });
  assert.deepEqual(keys.decrypt(envelope), { code: '123456' });
  assert.throws(() => keys.decrypt(envelope, 'mfa'));
  const parts = envelope.split('.');
  parts[2] = Buffer.alloc(16).toString('base64url');
  assert.throws(() => keys.decrypt(parts.join('.')));
});
