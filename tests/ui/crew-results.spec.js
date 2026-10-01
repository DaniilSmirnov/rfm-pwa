import { test, expect } from '@playwright/test';
import { seedFixtureRace, openApp } from './helpers.js';

async function openAllResults(page) {
  await page.getByRole('button', { name: 'Сегодня' }).click();
  await page.getByRole('button', { name: 'Все результаты' }).click();
}

test.describe('ASMG crew results', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await seedFixtureRace(page);
  });

  test('opens results only on demand, filters both views by class, and searches crews', async ({
    page,
  }) => {
    const results = page.locator('.results-tab-screen');
    await expect(results).toHaveCount(0);
    await openAllResults(page);
    await expect(results).toBeVisible();
    await expect(results.locator('.crew-results-inline')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Все' })).toBeVisible();

    const rows = page.locator('[data-crew-row]');
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText('Гожев Руслан / Коломиец Денис');
    await expect(rows.first()).toContainText('Skoda Fabia Rally2 Evo');
    await expect(rows.first()).toContainText('Абсолют');
    await expect(rows.nth(2)).toContainText('Гаврилов Клим / Еникеев Кирилл');

    await page.getByRole('button', { name: 'R5', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Сидоров Иван / Петров Павел');
    await page.getByRole('button', { name: 'Все', exact: true }).click();
    await expect(rows).toHaveCount(5);

    await page.locator('#crewResultsSearch').fill('40');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Жигунов Андрей / Аксаков Алексей');
    await page.getByRole('button', { name: 'Сегодня' }).click();
    await expect(results).toHaveCount(0);
  });

  test('opens a crew modal with stage-by-stage times', async ({ page }) => {
    await openAllResults(page);
    await expect(page.locator('.crew-results-inline')).toBeVisible();
    await expect(page.getByText('Результаты ASMG')).toBeVisible();
    const asmgLink = page.getByRole('link', { name: 'Открыть сайт ASMG' });
    await expect(asmgLink).toHaveAttribute('href', 'https://asmg.ru/');
    await expect(asmgLink).toHaveAttribute('target', '_blank');
    await expect(asmgLink.locator('svg')).toHaveAttribute('aria-label', 'ASMG');
    await expect(page.getByRole('button', { name: 'Фильтры' })).toHaveCount(0);
    const firstRow = page.locator('[data-crew-row]').first();
    await expect(firstRow).toContainText('00:14:50:0');
    await firstRow.getByRole('button', { name: /Открыть результаты экипажа/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Детали экипажа' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('z-index', '100003');
    await expect(dialog).toContainText('СУ 2 · Пуйккола');
    await expect(dialog).toContainText('00:14:50:0');
    const favorite = dialog.getByRole('button', { name: 'Добавить экипаж в избранное' });
    await expect(favorite).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(favorite).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await favorite.click();
    await expect(
      dialog.getByRole('button', { name: 'Удалить экипаж из избранного' }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Удалить экипаж из избранного' }).click();
    await expect(dialog.getByRole('button', { name: 'Добавить экипаж в избранное' })).toBeVisible();
  });

  test('stores a followed crew so the service worker can refresh it offline', async ({ page }) => {
    await openAllResults(page);
    await expect(page.locator('.crew-results-inline')).toBeVisible();
    const row = page.locator('[data-crew-row]').first();
    const favorite = row.getByRole('button', { name: /Следить за экипажем/ });
    await expect(favorite).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(favorite).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await favorite.click();
    await expect(row.getByRole('button', { name: /Отписаться от экипажа/ })).toBeVisible();
    const saved = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rallyfans-offline', 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return await new Promise((resolve, reject) => {
        const request = db
          .transaction('crewSubscriptions')
          .objectStore('crewSubscriptions')
          .getAll();
        request.onsuccess = () => {
          db.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      asmgRaceId: '55',
      crewId: '2273',
      name: 'Гожев Руслан / Коломиец Денис',
    });
  });
});
