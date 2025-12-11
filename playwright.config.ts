import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.e2e.ts',
    },
    {
      name: 'android-web',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/*.e2e.ts',
    },
  ],
});
