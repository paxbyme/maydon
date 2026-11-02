import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { compose, enableAccessibility, enterText } from './helpers.mjs';

test('approved owner creates a private facility draft that survives reload', async ({
  page,
}) => {
  const ownerId = randomUUID();
  const email = `${randomUUID()}@example.test`;
  const password = 'browser-facility-password-123!';
  // Isolated CI fixture: approval is a prerequisite, never a production shortcut.
  const seed = `const {PrismaClient}=require('@prisma/client'); const argon2=require('argon2'); const db=new PrismaClient(); (async()=>{const user=await db.user.create({data:{email:${JSON.stringify(email)},passwordHash:await argon2.hash(${JSON.stringify(password)}),displayName:'Facility browser owner',locale:'en',emailVerifiedAt:new Date(),roles:{create:{role:'PLAYER'}}}}); await db.ownerProfile.create({data:{id:${JSON.stringify(ownerId)},legalName:'Browser approved business',status:'APPROVED',memberships:{create:{userId:user.id}}}}); await db.$disconnect();})().catch(()=>process.exit(1));`;
  execFileSync('docker', [
    ...compose,
    'exec',
    '-T',
    'worker',
    'node',
    '-e',
    seed,
  ]);
  const responses = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/businesses/'))
      responses.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
  });
  try {
    await page.goto('http://localhost:5174/#/profile');
    await enableAccessibility(page);
    await enterText(
      page.getByRole('textbox', { name: 'Email', exact: true }),
      email,
    );
    await enterText(page.getByLabel('Password', { exact: true }), password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByText('Email verified', { exact: true }),
    ).toBeVisible();
    await page.goto(`http://localhost:5174/#/businesses/${ownerId}/facilities`);
    await enableAccessibility(page);
    await enterText(
      page.getByRole('textbox', {
        name: 'Street address in Namangan',
        exact: true,
      }),
      'Namangan, Browser street 12',
    );
    await enterText(
      page.getByRole('textbox', { name: 'Latitude', exact: true }),
      '40.9983',
    );
    await enterText(
      page.getByRole('textbox', { name: 'Longitude', exact: true }),
      '71.6726',
    );
    await enterText(
      page.getByRole('textbox', { name: 'Facility name', exact: true }).first(),
      'Browser Namangan court',
    );
    await enterText(
      page.getByRole('textbox', { name: /Description/ }).first(),
      'A private facility draft for a real browser journey.',
    );
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(
      page.getByText('Browser Namangan court', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await page.reload();
    await enableAccessibility(page);
    await expect(
      page.getByText('Browser Namangan court', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Namangan, Browser street 12', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Edit facility', exact: true }),
    ).toBeVisible();
  } catch (error) {
    console.log('Facility HTTP diagnostics:', JSON.stringify(responses));
    throw error;
  }
});
