import { test, expect } from '@playwright/test';
import { openApp, openMapWithAcceptedSafety } from './helpers.js';

test('uses the same orange borderless active state for every tab', async ({ page }) => {
  await openApp(page);
  const tabs = ['Сегодня', 'Карта', 'Результаты', 'Меню'];
  let activeColor = null;

  for (const label of tabs) {
    const button = page.locator('.bottom-tabbar').getByRole('button', { name: label });
    await button.click();
    await expect(button).toHaveAttribute('aria-current', 'page');
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(button).toHaveCSS('border-top-width', '0px');

    const iconColor = await button.locator('svg').evaluate(node => getComputedStyle(node).color);
    const labelColor = await button.locator('b').evaluate(node => getComputedStyle(node).color);
    activeColor ??= iconColor;
    expect(iconColor).toBe(activeColor);
    expect(labelColor).toBe(activeColor);
  }
});

test('switches between offline-first main tabs', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await expect(page.locator('.bottom-tabbar svg')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Сегодня' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await openMapWithAcceptedSafety(page);
  await expect(page.locator('body')).toHaveAttribute('data-active-tab', 'map');
  await page.getByRole('button', { name: 'Результаты' }).click();
  await expect(page.getByRole('heading', { name: 'Результаты экипажей' })).toBeVisible();
  await expect(page.locator('.results-tab-screen')).toContainText(
    'Смотри сохранённые результаты и обновляй данные',
  );
  await expect(page.locator('.crew-results-section')).toHaveCount(0);
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Гонки и Rally Pack' })).toBeVisible();
  await page.getByRole('button', { name: 'Гонки и Rally Pack' }).click();
  await expect(page.getByLabel('Управление гонками')).toBeVisible();
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('.screen-header')).toContainText('Управление гонками');
  await expect(page.getByLabel('Удалять автоматически по завершению гонки')).not.toBeChecked();
  await page.locator('.screen-header-back').click();
  await expect(page.getByRole('button', { name: 'Настройки и диагностика' })).toBeVisible();
  await expect(page).toHaveURL(/\?tab=more$/);
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await expect(page.locator('.react-tab-content')).toHaveCSS('padding-bottom', '0px');
  await expect(page.locator('.crew-results-section>.section-head')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-active-tab', 'more');
});

test('keeps legacy races deep links pointed at race management', async ({ page }) => {
  await openApp(page);
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/?tab=races`);
  await expect(page.getByLabel('Управление гонками')).toBeVisible();
});
