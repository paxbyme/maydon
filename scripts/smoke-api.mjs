import assert from 'node:assert/strict';

const base = process.env.MAYDON_API_URL ?? 'http://127.0.0.1:3000';
const endpoints = [
  ['/api/v1/health', { status: 'ok' }],
  [
    '/api/v1/version',
    { service: 'maydon-api', version: '0.1.0', apiVersion: 'v1' },
  ],
];
for (const [path, expected] of endpoints) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
  });
  assert.equal(response.status, 200, `${path} must return HTTP 200`);
  assert.deepEqual(
    await response.json(),
    expected,
    `${path} has an unexpected response`,
  );
  console.log(`PASS ${path}`);
}
const unversioned = await fetch(new URL('/health', base), {
  signal: AbortSignal.timeout(5000),
  redirect: 'error',
});
assert.equal(
  unversioned.status,
  404,
  'Unversioned /health must not be exposed',
);
console.log('PASS unversioned /health is absent');
