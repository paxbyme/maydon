import { test, expect } from '@playwright/test';
import { enableAccessibility } from './helpers.mjs';

// A non-interactive Flutter chip may expose a text leaf or an aria-label.
const sportName = (page, name) =>
  page
    .getByText(name, { exact: true })
    .or(page.getByLabel(name, { exact: true }))
    .first();
test('guest browses the translated sports catalog without signing in', async ({
  page,
  context,
}) => {
  await page.goto('http://localhost:5173/#/explore');
  await enableAccessibility(page);
  for (const name of ['Football', 'Basketball', 'Volleyball', 'Tennis'])
    await expect(sportName(page, name)).toBeVisible();
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Русский', exact: true }).click();
  for (const name of ['Футбол', 'Баскетбол', 'Волейбол', 'Теннис'])
    await expect(sportName(page, name)).toBeVisible();
  await page.reload();
  await enableAccessibility(page);
  await expect(sportName(page, 'Футбол')).toBeVisible();
  await page.getByRole('button', { name: 'Язык', exact: true }).click();
  await page.getByRole('menuitem', { name: 'O‘zbekcha', exact: true }).click();
  for (const name of ['Futbol', 'Basketbol', 'Voleybol', 'Tennis'])
    await expect(sportName(page, name)).toBeVisible();
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === '__Host-maydon-refresh',
    ),
  ).toBe(false);
});
