import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially for this flow
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.WEB_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev servers before tests (optional)
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'pnpm --filter api run dev',
          url: 'http://localhost:3001/health',
          reuseExistingServer: true,
          timeout: 120000,
        },
        {
          command: 'pnpm --filter web run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120000,
        },
      ],
});
