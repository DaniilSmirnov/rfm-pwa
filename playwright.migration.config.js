import { defineConfig, devices } from '@playwright/test';

const baseURL='http://127.0.0.1:4175';

export default defineConfig({
  testDir:'./tests/migration',
  timeout:60_000,
  expect:{timeout:10_000},
  fullyParallel:false,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?1:0,
  reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report-migration'}]],
  use:{
    ...devices['Desktop Chrome'],
    baseURL,
    serviceWorkers:'allow',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  webServer:{
    command:'node scripts/migration-server.mjs /tmp/rfm-main/dist dist 4175',
    url:baseURL,
    reuseExistingServer:false,
    timeout:15_000
  }
});
