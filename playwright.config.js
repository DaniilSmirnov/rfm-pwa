import { defineConfig, devices } from '@playwright/test';

const externalBaseURL=process.env.PLAYWRIGHT_BASE_URL;
const baseURL=externalBaseURL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/ui',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: externalBaseURL ? undefined : {
    command: 'npm run build && node scripts/serve-static.mjs --root dist --port 4173',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 20_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-iphone', use: { ...devices['iPhone 15'] } }
  ]
});
