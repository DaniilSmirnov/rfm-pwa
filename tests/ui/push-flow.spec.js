import { test, expect } from '@playwright/test';
import { installAppMocks } from './helpers.js';

const endpoint = 'https://push.example.test/subscription/123';
const subscriptionJson = { endpoint, keys: { p256dh: 'test-key', auth: 'test-auth' } };

async function openPushApp(
  page,
  { permission = 'default', existingSubscription = false, requestPermission = 'granted' } = {},
) {
  await installAppMocks(page, {
    push: { permission, existingSubscription, requestPermission, subscription: subscriptionJson },
  });

  await page.route('**/api/push/config', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, enabled: true, publicKey: 'AQIDBA', storage: true }),
    }),
  );
  await page.route('**/api/push/subscribe', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, stored: true }),
    }),
  );
  await page.route('**/api/push/test', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }),
  );
  await page.route('**/api/push/unsubscribe', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }),
  );
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() =>
    document.querySelector('#catalogStatus')?.textContent?.includes('гонок'),
  );
  await page.getByRole('button', { name: 'Ещё' }).click();
  await page.getByRole('button', { name: /Настройки и диагностика/ }).click();
}

test.describe('push notification browser flow', () => {
  test.skip(
    ({ isMobile }) => isMobile,
    'Push flows require a browser installation context, not iOS Safari emulation.',
  );

  test('enables notifications, registers the subscription and sends a test push', async ({
    page,
  }) => {
    await openPushApp(page);

    const subscribeRequestPromise = page.waitForRequest(request =>
      request.url().endsWith('/api/push/subscribe'),
    );
    await page.locator('#pushEnableBtn').click();
    const subscribeRequest = await subscribeRequestPromise;
    expect(await subscribeRequest.postDataJSON()).toEqual({ subscription: subscriptionJson });
    await expect(page.locator('#pushEnableBtn')).toHaveText('Выключить уведомления');
    await expect(page.locator('#pushTestBtn')).toBeVisible();
    await expect(page.locator('#pushStatus')).toContainText('Устройство подписано');

    const testRequestPromise = page.waitForRequest(request =>
      request.url().endsWith('/api/push/test'),
    );
    await page.locator('#pushTestBtn').click();
    const testRequest = await testRequestPromise;
    expect(await testRequest.postDataJSON()).toEqual({
      subscription: subscriptionJson,
      delaySeconds: 10,
    });
    await expect(page.locator('#pushStatus')).toContainText('Тестовый push запланирован');
  });

  test('keeps notifications off when browser permission is denied', async ({ page }) => {
    await openPushApp(page, { requestPermission: 'denied' });

    await page.locator('#pushEnableBtn').click();

    await expect(page.locator('#pushStatus')).toContainText(/разрешение на уведомления не выдано/i);
    await expect(page.locator('#pushEnableBtn')).toHaveText('Включить уведомления');
    await expect(page.locator('#pushTestBtn')).toBeHidden();
  });

  test('unsubscribes an already enabled browser subscription', async ({ page }) => {
    await openPushApp(page, { permission: 'granted', existingSubscription: true });
    await expect(page.locator('#pushEnableBtn')).toHaveText('Выключить уведомления');
    await expect(page.locator('#pushTestBtn')).toBeVisible();

    const unsubscribeRequest = page.waitForRequest(request =>
      request.url().endsWith('/api/push/unsubscribe'),
    );
    await page.locator('#pushEnableBtn').click();
    const request = await unsubscribeRequest;

    expect(await request.postDataJSON()).toEqual({ endpoint });
    await expect(page.locator('#pushEnableBtn')).toHaveText('Включить уведомления');
    await expect(page.locator('#pushTestBtn')).toBeHidden();
    await expect(page.locator('#pushStatus')).toContainText('Уведомления выключены');
  });
});
