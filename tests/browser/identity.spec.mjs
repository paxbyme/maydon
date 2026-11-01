import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const compose = [
  'compose',
  '-p',
  'maydon-browser',
  '--env-file',
  'infra/verification.env',
  '-f',
  'infra/compose.yaml',
];
async function enableAccessibility(page) {
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
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
    await page
      .getByRole('textbox', { name: 'Your name', exact: true })
      .fill('Browser player');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', {
        name: 'Verification reference from your message',
      }),
    ).toBeVisible();
    const verification = await message(email);
    await page
      .getByRole('textbox', {
        name: 'Verification reference from your message',
      })
      .fill(verification.challengeId);
    await page
      .getByRole('textbox', { name: 'Six-digit code' })
      .fill(verification.code);
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
    await page.getByLabel('Password', { exact: true }).fill(password);
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
      await page.getByLabel('Password', { exact: true }).fill(password);
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
      await page.getByRole('textbox', { name: 'Six-digit code' }).fill(code);
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
    await page.getByText('Русский', { exact: true }).click();
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
    await page.getByText('English', { exact: true }).click();

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
