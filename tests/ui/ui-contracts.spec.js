import { test, expect } from '@playwright/test';
import {
  openApp,
  openMapWithAcceptedSafety,
  openRaceManagement,
  seedFixtureRace,
  selectMapPoint,
} from './helpers.js';

test.describe('basic UI contracts', () => {
  test('main controls have accessible names', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('dialog', { name: 'Установка приложения' })).toBeHidden();
    await page.getByRole('button', { name: 'Меню' }).click();
    await expect(page.getByRole('button', { name: /Настройки и диагностика/ })).toBeVisible();
    await openRaceManagement(page);
    await expect(page.getByPlaceholder('Название гонки или этап…')).toBeVisible();
    await expect(page.getByLabel('Найти скачанную гонку')).toBeVisible();
    await expect(page.getByLabel('Удалять автоматически по завершению гонки')).not.toBeChecked();
  });

  test('search fields expose placeholders', async ({ page }) => {
    await openApp(page);
    await openRaceManagement(page);
    await expect(page.getByPlaceholder('Название гонки или этап…')).toHaveAttribute(
      'placeholder',
      /гонки или этап/,
    );
    await expect(page.getByPlaceholder('Название или этап…')).toHaveAttribute(
      'placeholder',
      /Название или этап/,
    );
  });

  test('image modal starts hidden', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#imageModal')).toBeHidden();
  });

  test('point actions start hidden before point selection', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#pointActions')).toBeHidden();
  });

  test('race details start hidden before download', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#raceDetails')).toBeHidden();
  });

  test('downloaded race exposes both top and map offline controls', async ({ page }) => {
    await openApp(page);
    await seedFixtureRace(page);
    await expect(page.locator('#downloadMapBtnTop')).toBeEnabled();
    await openMapWithAcceptedSafety(page);
    await page.getByRole('button', { name: 'Инструменты карты' }).click();
    await expect(page.locator('#downloadMapBtn')).toBeEnabled();
  });

  test('selected point exposes all navigation actions', async ({ page }) => {
    await openApp(page);
    await seedFixtureRace(page);
    await openMapWithAcceptedSafety(page);
    await selectMapPoint(page);
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    for (const id of [
      'googleMapsBtn',
      'yandexMapsBtn',
      'mapsMeBtn',
      'sharePointBtn',
      'copyCoordsBtn',
      'favoritePointBtn',
    ]) {
      await expect(page.locator('#' + id)).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#pointActions')).toBeHidden();
  });

  test('spectator compass section is present for selected point', async ({ page }) => {
    await openApp(page);
    await seedFixtureRace(page);
    await openMapWithAcceptedSafety(page);
    await selectMapPoint(page);
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    const compass = page.locator('#spectatorCompass');
    await expect(compass).toBeVisible();
    await compass.locator('summary').click();
    await expect(page.locator('#compassEnableBtn')).toBeVisible();
  });
});
