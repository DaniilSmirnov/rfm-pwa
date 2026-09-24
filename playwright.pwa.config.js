import { defineConfig, devices } from '@playwright/test';

const baseURL='http://127.0.0.1:4174';

export default defineConfig({
  testDir:'./tests/pwa',
  timeout:30_000,
  expect:{timeout:8_000},
  fullyParallel:false,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?1:0,
  reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report-pwa'}]],
  use:{
    ...devices['Desktop Chrome'],
    baseURL,
    serviceWorkers:'allow',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  webServer:{
    command:'npm run build && npx http-server dist -p 4174 -c-1 --silent',
    url:baseURL,
    reuseExistingServer:true,
    timeout:30_000
  }
});
