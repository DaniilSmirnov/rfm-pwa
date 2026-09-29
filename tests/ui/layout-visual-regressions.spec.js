import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function getBounds(page, selector) {
  return page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
}

test('aligns the brand left and race selector right without a network label or PWA install button', async ({
  page,
}) => {
  await openApp(page);

  const header = await getBounds(page, '.topbar');
  const brand = await getBounds(page, '.header-brand');
  const actions = await getBounds(page, '.top-actions');

  expect(header.height).toBeGreaterThan(0);
  expect(brand.left - header.left).toBeLessThanOrEqual(40);
  expect(brand.left).toBeLessThan(header.left + header.width / 2);
  expect(brand.right).toBeLessThanOrEqual(actions.left);
  expect(header.right - actions.right).toBeLessThanOrEqual(40);
  expect(actions.left).toBeGreaterThan(header.left + header.width / 2);
  await expect(page.getByRole('button', { name: 'Установить PWA' })).toHaveCount(0);
  await expect(page.locator('.top-actions button')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Текущая гонка' })).toBeVisible();
  await expect(page.locator('#networkBadge')).toHaveCount(0);
});

test('places More controls at the top and leaves the complete footer clear of the fixed tab bar', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Ещё' }).click();

  const footer = page.locator('.app-footer');
  const menu = page.locator('.more-menu');
  const header = await getBounds(page, '.topbar');
  await expect(menu.getByRole('button', { name: /Настройки и диагностика/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Гонки' })).toBeVisible();
  expect((await getBounds(page, '.more-menu')).top).toBeGreaterThanOrEqual(header.bottom);
  expect((await getBounds(page, '.more-menu')).top).toBeLessThan(page.viewportSize().height);
  await expect(footer).toBeVisible();
  expect((await getBounds(page, '.more-menu')).bottom).toBeLessThanOrEqual(
    (await getBounds(page, '.app-footer')).top,
  );

  await page.getByRole('button', { name: /Настройки и диагностика/ }).click();
  await expect(page.getByRole('heading', { name: 'Настройки и диагностика' })).toBeVisible();
  expect((await getBounds(page, '.settings-screen')).bottom).toBeLessThanOrEqual(
    (await getBounds(page, '.app-footer')).top,
  );

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const footerBounds = await getBounds(page, '.app-footer');
  const tabBarTop = (await getBounds(page, '.bottom-tabbar')).top;
  expect(footerBounds.bottom).toBeLessThanOrEqual(tabBarTop - 16);
  await expect(page.getByText(/Companion v/)).toBeInViewport();
  const footerText = await page.getByText(/Companion v/).boundingBox();
  expect(footerText.y + footerText.height).toBeLessThanOrEqual(tabBarTop - 16);
});
