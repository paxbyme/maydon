import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    browserName: 'chromium',
    actionTimeout: 20000,
    viewport: { width: 1280, height: 900 },
    trace: 'off',
    screenshot: 'off',
  },
  reporter: 'list',
  webServer: {
    command: 'node scripts/serve-web.mjs',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
