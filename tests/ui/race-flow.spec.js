import { test, expect } from '@playwright/test';
import {
  openApp,
  openMapWithAcceptedSafety,
  openRaceManagement,
  seedFixtureRace,
  selectMapPoint,
  openFavoritesPanel,
  openCarPanel,
  raceFixture,
} from './helpers.js';

test.describe('saved race user flows', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await seedFixtureRace(page);
  });
  const openMap = page => openMapWithAcceptedSafety(page);
  const openMapTools = page => page.getByRole('button', { name: 'Инструменты карты' }).click();

  test('opens downloaded race details', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2, name: raceFixture.name })).toHaveText(
      raceFixture.name,
    );
    await expect(page.locator('#raceMeta')).toContainText('Сортавала');
    await expect(page.locator('#raceMeta')).toContainText('26.09.2026');
  });

  test('renders race statistics', async ({ page }) => {
    await expect(page.locator('#raceStats')).toContainText('120 км');
    await expect(page.locator('#raceStats')).toContainText('82 км');
    await expect(page.locator('#raceStats')).toContainText('2');
  });

  test('renders stage schedule and events', async ({ page }) => {
    await expect(page.locator('#scheduleList')).toContainText('СУ 1 Сортавала');
    await expect(page.locator('#scheduleList')).toContainText('10:00');
    await expect(page.locator('#scheduleList')).toContainText('Закрытие дороги');
    await expect(page.locator('#scheduleList')).toContainText('Открытие дороги');
  });

  test('renders stage notification control', async ({ page }) => {
    const button = page.locator('[data-stage-key]');
    await expect(button).toBeVisible();
    await expect(button).toContainText('Уведомлять');
  });

  test('sanitizes upstream race HTML', async ({ page }) => {
    await expect(page.locator('#raceMedia')).toContainText('История этапа');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('#raceMedia script')).toHaveCount(0);
    const link = page.locator('.how-it-was a');
    await expect(link).toHaveCount(1);
    await expect(link).not.toHaveAttribute('href', /javascript:/);
  });

  test('shows organizer media sections', async ({ page }) => {
    await expect(page.locator('#raceMedia')).toContainText('КАРТА ОРГАНИЗАТОРА');
    await expect(page.locator('#raceMedia')).toContainText('ПАМЯТКА ПО БЕЗОПАСНОСТИ');
  });

  test('opens and closes image modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Меню', exact: true }).click();
    await page.getByRole('button', { name: 'Документы и материалы' }).click();
    const documents = page.getByLabel('Документы гонки');
    await documents.getByText('КАРТА ОРГАНИЗАТОРА').click();
    const media = documents.locator('[data-media-name]').first();
    await media.click();
    await expect(documents.locator('#imageModal')).toBeVisible();
    await documents.locator('#imageModalClose').click();
    await expect(documents.locator('#imageModal')).toBeHidden();
  });

  test('renders saved package row', async ({ page }) => {
    await openRaceManagement(page);
    await expect(page.locator('#packageList')).toContainText(raceFixture.name);
    await expect(page.locator('#packageList')).not.toContainText('тайлов');
    await expect(page.locator('#packageList')).not.toContainText('JSON');
    await expect(
      page.locator('#packageList').getByRole('button', { name: 'Обновить' }),
    ).toBeVisible();
    await expect(
      page.locator('#packageList').getByRole('button', { name: 'Удалить' }),
    ).toBeVisible();
  });

  test('shows saved race artwork and Rally Pack refresh on Today tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Сегодня' }).click();
    await expect(page.locator('.today-race-card')).toContainText(raceFixture.name);
    await expect(page.locator('.today-race-card')).toContainText('Обновить Rally Pack');
    await expect(page.locator('.today-race-card')).toHaveAttribute('style', /hero\.jpg/);
  });

  test('starts Rally Pack refresh from Today without missing downloader dependencies', async ({
    page,
  }) => {
    const raceRequest = page.waitForRequest(request =>
      request.url().includes(`/api/rallyfans/race/${raceFixture.id}`),
    );
    await page.getByRole('button', { name: 'Сегодня' }).click();
    await page
      .locator('.today-race-card')
      .getByRole('button', { name: 'Обновить Rally Pack' })
      .click();
    await raceRequest;
  });

  test('filters saved package list', async ({ page }) => {
    await openRaceManagement(page);
    await page.getByPlaceholder('Название или этап…').fill('Sortavala');
    await expect(page.locator('#packageList')).toContainText(raceFixture.name);
    await page.getByPlaceholder('Название или этап…').fill('missing');
    await expect(page.locator('#packageList')).toContainText('По этому запросу гонок не найдено');
  });

  test('automatically removes a completed race only after the preference is enabled', async ({
    page,
  }) => {
    await openRaceManagement(page);
    await expect(page.getByLabel('Удалять автоматически по завершению гонки')).not.toBeChecked();
    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rallyfans-offline');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('packages', 'readwrite');
        const store = tx.objectStore('packages');
        const get = store.get('race-101');
        get.onsuccess = () => {
          get.result.original.status_race = 'Завершена';
          get.result.summary.status = 'Завершена';
          store.put(get.result);
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      window.dispatchEvent(new Event('rfm:refresh-local-data'));
    });
    await page.getByLabel('Удалять автоматически по завершению гонки').check();
    await expect(page.locator('#packageList')).toContainText('Скачанных гонок пока нет');
  });

  test('exports a valid GeoJSON file', async ({ page }) => {
    await openMap(page);
    await openMapTools(page);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportGeoJsonBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.geojson$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.some(f => f?.properties?.name === 'Смотровая точка')).toBe(true);
  });

  test('exports a GPX file with rally waypoints', async ({ page }) => {
    await openMap(page);
    await openMapTools(page);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportGpxBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.gpx$/);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const xml = Buffer.concat(chunks).toString('utf8');
    expect(xml).toContain('<gpx');
    expect(xml).toContain('<wpt lat="61.702" lon="30.691">');
    expect(xml).toContain('<name>Смотровая точка</name>');
  });

  test('renders rally points on the map', async ({ page }) => {
    await openMap(page);
    const point = page.locator('.map-race-label').filter({ hasText: 'Смотровая точка' });
    const fallbackPoint = page.getByRole('button', { name: 'Смотровая точка', exact: true });
    await expect(point.or(fallbackPoint)).toBeVisible();
    const parking = page.locator('.map-race-label').filter({ hasText: 'Парковка зрителей' });
    const fallbackParking = page.getByRole('button', { name: 'Парковка зрителей', exact: true });
    await expect(parking.or(fallbackParking)).toBeVisible();
  });

  test('opens actions for selected point', async ({ page }) => {
    await openMap(page);
    await selectMapPoint(page);
    await expect(page.locator('#pointActions')).toBeVisible();
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    await expect(page.locator('#pointName')).toHaveText('Смотровая точка');
    await expect(page.locator('#pointCoords')).toContainText('61.702000');
    await expect(page.locator('#pointElevation')).toContainText('рельеф не скачан');
    await expect(page.locator('#pointStageDistance')).toContainText('СУ 1:');
    await expect(page.locator('#pointStageDistance')).toContainText('от старта');
    await expect(page.locator('#pointStageDistance')).toContainText('до финиша');
  });

  test('adds and removes point from favorites', async ({ page }) => {
    await openMap(page);
    await selectMapPoint(page);
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    await page.locator('#favoritePointBtn').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#pointActions')).toBeHidden();
    await openFavoritesPanel(page);
    await expect(page.locator('#favoritesList')).toContainText('Смотровая точка');
    await page.locator('#favoritesList .point-row-copy').click();
    await expect(page.locator('#pointActions')).toBeVisible();
    await page.keyboard.press('Escape');
    await openFavoritesPanel(page);
    await page.locator('#favoritesList').getByRole('button', { name: 'Удалить' }).click();
    await expect(page.locator('#favoritesList')).toHaveCount(0);
    await expect(page.getByText('Пока ничего нет')).toBeVisible();
  });

  test('favorite state is reflected in point button', async ({ page }) => {
    await openMap(page);
    await selectMapPoint(page);
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    const fav = page.locator('#favoritePointBtn');
    await fav.click();
    await expect(fav).toContainText('★ В избранном');
  });

  test('favorite survives page reload', async ({ page }) => {
    await openMap(page);
    await selectMapPoint(page);
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    await page.locator('#favoritePointBtn').click();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await openMap(page);
    await openFavoritesPanel(page);
    await expect(page.locator('#favoritesList')).toContainText('Смотровая точка');
  });

  test('copies point coordinates', async ({ page }) => {
    await openMap(page);
    await selectMapPoint(page);
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    await page.locator('#copyCoordsBtn').click();
    await expect.poll(() => page.evaluate(() => window.__copied)).toContain('61.702000');
  });

  test('saves current geolocation as car position', async ({ page }) => {
    await openMap(page);
    await openCarPanel(page);
    await page.locator('#saveCarBtn').click();
    await expect(page.locator('#carPointCard')).toBeVisible();
    await expect(page.locator('#carCoords')).toContainText('61.700000');
    await expect(page.locator('#saveCarBtn')).toContainText('Обновить');
  });

  test('saved car position survives page reload', async ({ page }) => {
    await openMap(page);
    await openCarPanel(page);
    await page.locator('#saveCarBtn').click();
    await expect(page.locator('#carPointCard')).toBeVisible();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await openMap(page);
    await openCarPanel(page);
    await expect(page.locator('#carPointCard')).toBeVisible();
    await expect(page.locator('#carCoords')).toContainText('61.700000');
  });

  test('opens spectator compass for saved car', async ({ page }) => {
    await openMap(page);
    await openCarPanel(page);
    await page.locator('#saveCarBtn').click();
    await page.locator('#carCompassBtn').click();
    await expect(page.locator('#pointActions')).toBeVisible();
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    await expect(page.locator('#pointName')).toHaveText('Машина');
    await expect(page.locator('#spectatorCompass')).toHaveAttribute('open', '');
    await expect(page.locator('#compassDistance')).not.toHaveText('—');
  });

  test('deletes saved car position', async ({ page }) => {
    await openMap(page);
    await openCarPanel(page);
    await page.locator('#saveCarBtn').click();
    await expect(page.locator('#carPointCard')).toBeVisible();
    await page.locator('#carDeleteBtn').click();
    await expect(page.locator('#carPointCard')).toBeHidden();
  });

  test('location button updates GPS status', async ({ page }) => {
    await openMap(page);
    await page.locator('#locateBtn').click();
    await expect(page.locator('#geoStatus')).toContainText('точность ±5 м');
  });

  test('keeps the map instance stable while GPS position updates', async ({ page }) => {
    await openMap(page);
    const mapCount = await page.evaluate(() => window.__mapCreateCount);
    await page.locator('#locateBtn').click();
    await expect(page.locator('#geoStatus')).toContainText('точность ±5 м');
    await expect.poll(() => page.evaluate(() => window.__mapCreateCount)).toBe(mapCount);
  });

  test('map engine diagnostic reports MapLibre', async ({ page }) => {
    await openMap(page);
    await page.getByRole('button', { name: 'Меню' }).click();
    await page.getByRole('button', { name: /Настройки и диагностика/ }).click();
    await expect(page.locator('.settings-diagnostics')).toContainText('MapLibre ✓');
  });

  test('clear all removes offline race and favorites', async ({ page }) => {
    await openMap(page);
    await selectMapPoint(page);
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
    await page.locator('#favoritePointBtn').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#pointActions')).toBeHidden();
    await openRaceManagement(page);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#clearBtn').click();
    await openRaceManagement(page);
    await expect(page.locator('#packageList')).toContainText('Скачанных гонок пока нет');
    await expect(page.locator('.race-page')).toBeHidden();
  });
});
