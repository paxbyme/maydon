import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { compose, enableAccessibility, enterText } from './helpers.mjs';
async function message(email) {
  let result;
  await expect
    .poll(
      () => {
        const script = `const fs=require('node:fs'); const directory='/app/dev-mailbox'; const matches=fs.readdirSync(directory).map(name=>JSON.parse(fs.readFileSync(directory+'/'+name,'utf8'))).filter(m=>m.to===${JSON.stringify(email)}); if(matches.length) process.stdout.write(JSON.stringify(matches.at(-1)));`;
        const output = execFileSync(
          'docker',
          [...compose, 'exec', '-T', 'worker', 'node', '-e', script],
          { encoding: 'utf8' },
        );
        result = output ? JSON.parse(output) : undefined;
        return !!result;
      },
      { timeout: 20000 },
    )
    .toBe(true);
  return result;
}
test.beforeEach(async ({ page }, testInfo) => {
  const requests = [];
  page.on('request', (request) => {
    if (!request.url().includes('/api/v1/auth/')) return;
    let fields = {};
    try {
      const body = request.postDataJSON();
      fields = Object.fromEntries(
        Object.entries(body ?? {}).map(([key, value]) => [
          key,
          typeof value === 'string'
            ? { type: 'string', length: value.length }
            : { type: typeof value },
        ]),
      );
    } catch {}
    requests.push({
      path: new URL(request.url()).pathname,
      method: request.method(),
      fields,
    });
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/auth/'))
      requests.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
  });
  testInfo.annotations.push({
    type: 'diagnostics',
    description: JSON.stringify(requests),
  });
  page.on('pageerror', (error) =>
    console.log(
      'Browser runtime error:',
      error.name,
      error.message.replace(/[A-Z2-7]{32}/g, '[redacted]'),
    ),
  );
  testInfo._safeRequests = requests;
});
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  console.log(
    'Safe request diagnostics:',
    JSON.stringify(testInfo._safeRequests),
  );
  const visible = await page.locator('flt-semantics').allTextContents();
  console.log(
    'Visible semantic text:',
    JSON.stringify(
      [...new Set(visible)]
        .filter((text) => text.trim())
        .map((text) => text.replace(/[A-Z2-7]{32}/g, '[redacted]'))
        .slice(-35),
    ),
  );
});
for (const [index, app] of ['player', 'owner', 'admin'].entries()) {
  test(`${app}: register, verify email, sign in, restore secure cookie, sign out`, async ({
    page,
    context,
  }) => {
    const email = `${randomUUID()}@example.test`;
    const password = 'browser-test-password-123!';
    await page.goto(
      `http://localhost:${5173 + index}/#/` +
        (app !== 'admin' ? 'profile' : ''),
    );
    await enableAccessibility(page);
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await enterText(
      page.getByRole('textbox', { name: 'Email', exact: true }),
      email,
    );
    await enterText(
      page.getByRole('textbox', { name: 'Your name', exact: true }),
      'Browser player',
    );
    await enterText(page.getByLabel('Password', { exact: true }), password);
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', {
        name: 'Verification reference from your message',
      }),
    ).toBeVisible();
    const verification = await message(email);
    await enterText(
      page.getByRole('textbox', {
        name: 'Verification reference from your message',
      }),
      verification.challengeId,
    );
    await enterText(
      page.getByRole('textbox', { name: 'Six-digit code' }),
      verification.code,
    );
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    if (app === 'admin') {
      const grant = `const {PrismaClient}=require('@prisma/client'); const db=new PrismaClient(); (async()=>{const user=await db.user.findUniqueOrThrow({where:{email:${JSON.stringify(email)}}}); await db.userRole.create({data:{userId:user.id,role:'ADMIN'}}); await db.$disconnect();})().catch(()=>process.exit(1));`;
      execFileSync('docker', [
        ...compose,
        'exec',
        '-T',
        'worker',
        'node',
        '-e',
        grant,
      ]);
    }
    await enterText(page.getByLabel('Password', { exact: true }), password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    if (app === 'admin') {
      await expect(
        page.getByText('Complete authenticator verification to continue.', {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Set up authenticator', exact: true })
        .click();
      await enterText(page.getByLabel('Password', { exact: true }), password);
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      const secret = await page.getByText(/^[A-Z2-7]{32}$/).textContent();
      const code = execFileSync(
        'docker',
        [
          ...compose,
          'exec',
          '-T',
          'worker',
          'node',
          '-e',
          "process.stdout.write(require('./apps/api/dist/src/identity/totp.js').totpAt(process.argv[1], Math.floor(Date.now()/30000)))",
          secret,
        ],
        { encoding: 'utf8' },
      );
      await enterText(
        page.getByRole('textbox', { name: 'Six-digit code' }),
        code,
      );
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    }
    await expect(
      page.getByText('Email verified', { exact: true }),
    ).toBeVisible();
    const cookie = (await context.cookies()).find(
      (item) => item.name === '__Host-maydon-refresh',
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
    const storage = await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
    expect(JSON.stringify(storage)).not.toMatch(
      /accessToken|refreshToken|test-access|new-credential/,
    );
    await page.getByRole('button', { name: 'Language', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Русский', exact: true }).click();
    await expect(
      page.getByText('Почта подтверждена', { exact: true }),
    ).toBeVisible();
    const secondTab = await context.newPage();
    await Promise.all([page.reload(), secondTab.goto(page.url())]);
    await Promise.all([
      enableAccessibility(page),
      enableAccessibility(secondTab),
    ]);
    await expect(
      secondTab.getByText('Почта подтверждена', { exact: true }),
    ).toBeVisible();
    await secondTab.close();
    await expect(
      page.getByText('Почта подтверждена', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Язык', exact: true }).click();
    await page.getByRole('menuitem', { name: 'English', exact: true }).click();

    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    expect(
      (await context.cookies()).some(
        (item) => item.name === '__Host-maydon-refresh',
      ),
    ).toBe(false);
  });
}
