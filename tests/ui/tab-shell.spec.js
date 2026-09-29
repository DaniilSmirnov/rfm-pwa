import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

test('switches between offline-first main tabs', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await expect(page.locator('.bottom-tabbar svg')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Сегодня' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('button', { name: 'Карта' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-active-tab', 'map');
  await page.getByRole('button', { name: 'Результаты' }).click();
  await expect(page.getByRole('heading', { name: 'Результаты экипажей' })).toBeVisible();
  await expect(page.locator('.crew-results-section')).toBeVisible();
  await page.getByRole('button', { name: 'Ещё' }).click();
  await expect(page.getByRole('button', { name: 'Гонки и Rally Pack' })).toBeVisible();
  await page.getByRole('button', { name: 'Гонки и Rally Pack' }).click();
  await expect(page.getByLabel('Управление гонками')).toBeVisible();
  await expect(page.getByLabel('Удалять автоматически по завершению гонки')).not.toBeChecked();
  await page.getByRole('button', { name: 'Назад в меню «Ещё»' }).click();
  await expect(page.getByRole('button', { name: 'Настройки и диагностика' })).toBeVisible();
  await expect(page).toHaveURL(/\?tab=more$/);
  await page.getByRole('button', { name: 'Ещё' }).click();
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
