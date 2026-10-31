import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const locales = ['en', 'uz', 'ru'];
let expected;
for (const locale of locales) {
  const data = JSON.parse(
    readFileSync(`packages/localization/lib/l10n/app_${locale}.arb`, 'utf8'),
  );
  assert.equal(data['@@locale'], locale);
  const keys = Object.keys(data)
    .filter((key) => !key.startsWith('@'))
    .sort();
  if (expected)
    assert.deepEqual(keys, expected, `Incomplete ${locale} translations`);
  else expected = keys;
  for (const key of keys)
    assert.ok(
      typeof data[key] === 'string' && data[key].trim(),
      `${locale}.${key} is empty`,
    );
}
console.log('All three ARB catalogs have matching, nonempty keys.');
