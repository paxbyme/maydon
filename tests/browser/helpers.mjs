import { expect } from '@playwright/test';
export const compose = [
  'compose',
  '-p',
  'maydon-browser',
  '--env-file',
  'infra/verification.env',
  '-f',
  'infra/compose.yaml',
];
export async function enableAccessibility(page) {
  await expect
    .poll(
      () => page.locator('flt-semantics-placeholder, flt-semantics').count(),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
  const activate = page.locator('flt-semantics-placeholder');
  if (await activate.count())
    await activate.evaluate((element) => element.click());
}
// Flutter's semantic input can be replaced when focus opens its editing bridge.
// Use keyboard events and blur to commit editing, as an actual keyboard user does.
export async function enterText(field, value) {
  await field.click();
  // DOM focus precedes Flutter's semantics update, which attaches the input
  // listener. Wait across the render boundary before sending the first key.
  await field.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  await expect(field).toBeFocused();
  await field.pressSequentially(value, { delay: 20 });
  // Do not let assertion failures print passwords, OTPs or challenge IDs.
  await expect
    .poll(async () => (await field.inputValue()) === value)
    .toBe(true);
  await field.press('Tab');
}
