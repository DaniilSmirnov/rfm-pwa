import { test, expect } from '@playwright/test';
import { openApp, seedFixtureRace, raceFixture } from './helpers.js';

test.describe('saved race user flows',()=>{
  test.beforeEach(async({page})=>{await openApp(page);await seedFixtureRace(page);});
  const openMap=page=>page.getByRole('button',{name:'Карта'}).click();

  test('opens downloaded race details',async({page})=>{
    await expect(page.locator('#raceTitle')).toHaveText(raceFixture.name);
    await expect(page.locator('#raceMeta')).toContainText('Сортавала');
    await expect(page.locator('#raceMeta')).toContainText('26.09.2026');
  });

  test('renders race statistics',async({page})=>{
    await expect(page.locator('#raceStats')).toContainText('120 км');
    await expect(page.locator('#raceStats')).toContainText('82 км');
    await expect(page.locator('#raceStats')).toContainText('2');
  });

  test('renders stage schedule and events',async({page})=>{
    await expect(page.locator('#scheduleList')).toContainText('СУ 1 Сортавала');
    await expect(page.locator('#scheduleList')).toContainText('10:00');
    await expect(page.locator('#scheduleList')).toContainText('Закрытие дороги');
    await expect(page.locator('#scheduleList')).toContainText('Открытие дороги');
  });

  test('renders stage notification control',async({page})=>{
    const button=page.locator('[data-stage-key]');
    await expect(button).toBeVisible();
    await expect(button).toContainText('Уведомлять');
  });

  test('sanitizes upstream race HTML',async({page})=>{
    await expect(page.locator('#raceMedia')).toContainText('История этапа');
    expect(await page.evaluate(()=>window.__xss)).toBeUndefined();
    await expect(page.locator('#raceMedia script')).toHaveCount(0);
    const link=page.locator('.how-it-was a');
    await expect(link).toHaveCount(1);
    await expect(link).not.toHaveAttribute('href',/javascript:/);
  });

  test('shows organizer media sections',async({page})=>{
    await expect(page.locator('#raceMedia')).toContainText('КАРТА ОРГАНИЗАТОРА');
    await expect(page.locator('#raceMedia')).toContainText('ПАМЯТКА ПО БЕЗОПАСНОСТИ');
  });

  test('opens and closes image modal',async({page})=>{
    await page.getByText('КАРТА ОРГАНИЗАТОРА').click();
    const media=page.locator('[data-media-name]').first();
    await media.click();
    await expect(page.locator('#imageModal')).toBeVisible();
    await page.locator('#imageModalClose').click();
    await expect(page.locator('#imageModal')).toBeHidden();
  });

  test('renders saved package row',async({page})=>{
    await expect(page.locator('#packageList')).toContainText(raceFixture.name);
    await expect(page.locator('#storageStats')).toContainText('1 гонок');
  });

  test('shows saved race artwork and Rally Pack refresh on Today tab',async({page})=>{
    await page.getByRole('button',{name:'Сегодня'}).click();
    await expect(page.locator('.today-race-card')).toContainText(raceFixture.name);
    await expect(page.locator('.today-race-card')).toContainText('Обновить Rally Pack');
    await expect(page.locator('.today-race-card')).toHaveAttribute('style',/hero\.jpg/);
  });

  test('starts Rally Pack refresh from Today without missing downloader dependencies',async({page})=>{
    const raceRequest=page.waitForRequest(request=>request.url().includes(`/api/rallyfans/race/${raceFixture.id}`));
    await page.getByRole('button',{name:'Сегодня'}).click();
    await page.locator('.today-race-card').getByRole('button',{name:'Обновить Rally Pack'}).click();
    await raceRequest;
  });

  test('filters saved package list',async({page})=>{
    await page.locator('#packageSearch').fill('Sortavala');
    await expect(page.locator('#packageList')).toContainText(raceFixture.name);
    await page.locator('#packageSearch').fill('missing');
    await expect(page.locator('#packageList')).toContainText('Ничего не найдено');
  });

  test('exports a valid GeoJSON file',async({page})=>{
    await openMap(page);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#exportGeoJsonBtn').click();
    const download=await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.geojson$/);
    const stream=await download.createReadStream();
    const chunks=[];
    for await (const chunk of stream) chunks.push(chunk);
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.some(f=>f?.properties?.name==='Смотровая точка')).toBe(true);
  });

  test('exports a GPX file with rally waypoints',async({page})=>{
    await openMap(page);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#exportGpxBtn').click();
    const download=await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.gpx$/);
    const stream=await download.createReadStream();
    const chunks=[];
    for await (const chunk of stream) chunks.push(chunk);
    const xml=Buffer.concat(chunks).toString('utf8');
    expect(xml).toContain('<gpx');
    expect(xml).toContain('<wpt lat="61.702" lon="30.691">');
    expect(xml).toContain('<name>Смотровая точка</name>');
  });

  test('renders rally point list',async({page})=>{
    await openMap(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    await expect(page.locator('#pointList')).toContainText('Смотровая точка');
    await expect(page.locator('#pointList')).toContainText('Парковка зрителей');
  });

  test('opens actions for selected point',async({page})=>{
    await openMap(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    await page.locator('.point-row').filter({hasText:'Смотровая точка'}).locator('.point-row-copy').click();
    await expect(page.locator('#pointActions')).toBeVisible();
    await expect(page.locator('#pointName')).toHaveText('Смотровая точка');
    await expect(page.locator('#pointCoords')).toContainText('61.702000');
    await expect(page.locator('#pointStageDistance')).toContainText('СУ 1:');
    await expect(page.locator('#pointStageDistance')).toContainText('от старта');
    await expect(page.locator('#pointStageDistance')).toContainText('до финиша');
  });

  test('adds and removes point from favorites',async({page})=>{
    await openMap(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    const row=page.locator('.point-row').filter({hasText:'Смотровая точка'});
    await row.locator('[data-nav="favorite"]').click();
    await expect(page.locator('#favoritesList')).toContainText('Смотровая точка');
    await page.locator('#favoritesList').getByRole('button',{name:'Удалить'}).click();
    await expect(page.locator('#favoritesList')).toContainText('Пока пусто');
  });

  test('favorite state is reflected in point button',async({page})=>{
    await openMap(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    const row=page.locator('.point-row').filter({hasText:'Смотровая точка'});
    const fav=row.locator('[data-nav="favorite"]');
    await fav.click();
    await expect(page.locator('.point-row').filter({hasText:'Смотровая точка'}).locator('[data-nav="favorite"]')).toContainText('★ Избранное');
  });

  test('favorite survives page reload',async({page})=>{
    await openMap(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    await page.locator('.point-row').filter({hasText:'Смотровая точка'}).locator('[data-nav="favorite"]').click();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#favoritesList')).toContainText('Смотровая точка');
  });

  test('copies point coordinates',async({page})=>{
    await openMap(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    const row=page.locator('.point-row').filter({hasText:'Смотровая точка'});
    await row.locator('[data-nav="copy"]').click();
    await expect.poll(()=>page.evaluate(()=>window.__copied)).toContain('61.702000');
  });

  test('saves current geolocation as car position',async({page})=>{
    await openMap(page);
    await page.locator('#saveCarBtn').click();
    await expect(page.locator('#carPointCard')).toBeVisible();
    await expect(page.locator('#carCoords')).toContainText('61.700000');
    await expect(page.locator('#saveCarBtn')).toContainText('Обновить');
  });

  test('saved car position survives page reload',async({page})=>{
    await openMap(page);
    await page.locator('#saveCarBtn').click();
    await expect(page.locator('#carPointCard')).toBeVisible();
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#carPointCard')).toBeVisible();
    await expect(page.locator('#carCoords')).toContainText('61.700000');
  });

  test('opens spectator compass for saved car',async({page})=>{
    await openMap(page);
    await page.locator('#saveCarBtn').click();
    await page.locator('#carCompassBtn').click();
    await expect(page.locator('#pointActions')).toBeVisible();
    await expect(page.locator('#pointName')).toHaveText('Машина');
    await expect(page.locator('#spectatorCompass')).toHaveAttribute('open','');
    await expect(page.locator('#compassDistance')).not.toHaveText('—');
  });

  test('deletes saved car position',async({page})=>{
    await openMap(page);
    await page.locator('#saveCarBtn').click();
    await expect(page.locator('#carPointCard')).toBeVisible();
    await page.locator('#carDeleteBtn').click();
    await expect(page.locator('#carPointCard')).toBeHidden();
  });

  test('location button updates GPS status',async({page})=>{
    await openMap(page);
    await page.locator('#locateBtn').click();
    await expect(page.locator('#geoStatus')).toContainText('точность ±5 м');
  });

  test('map engine diagnostic reports MapLibre',async({page})=>{
    await openMap(page);
    await expect(page.locator('#offlineMapDiag')).toContainText('MapLibre ✓');
  });

  test('clear all removes offline race and favorites',async({page})=>{
    await openMap(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    await page.locator('.point-row').first().locator('[data-nav="favorite"]').click();
    await page.getByRole('button',{name:'Ещё'}).click();
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#clearBtn').click();
    await expect(page.locator('#packageList')).toContainText('Пока ничего не скачано');
    await expect(page.locator('#raceDetails')).toBeHidden();
  });
});
