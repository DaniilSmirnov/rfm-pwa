import { test, expect } from '@playwright/test';
import { openApp, downloadFixtureRace } from './helpers.js';

test.describe('basic UI contracts',()=>{
  test('main controls have accessible names',async({page})=>{
    await openApp(page);
    await expect(page.getByRole('button',{name:'Обновить каталог'})).toBeVisible();
    await expect(page.getByRole('button',{name:/Установить PWA/})).toBeVisible();
    await expect(page.getByRole('button',{name:'Удалить все офлайн-данные'})).toBeVisible();
  });

  test('search fields expose placeholders',async({page})=>{
    await openApp(page);
    await expect(page.locator('#catalogSearch')).toHaveAttribute('placeholder',/Карелия/);
    await expect(page.locator('#packageSearch')).toHaveAttribute('placeholder',/сохранённую гонку/);
  });

  test('image modal starts hidden',async({page})=>{
    await openApp(page);
    await expect(page.locator('#imageModal')).toBeHidden();
  });

  test('point actions start hidden before point selection',async({page})=>{
    await openApp(page);
    await expect(page.locator('#pointActions')).toBeHidden();
  });

  test('race details start hidden before download',async({page})=>{
    await openApp(page);
    await expect(page.locator('#raceDetails')).toBeHidden();
  });

  test('downloaded race exposes both top and map offline controls',async({page})=>{
    await openApp(page);
    await downloadFixtureRace(page);
    await expect(page.locator('#downloadMapBtnTop')).toBeEnabled();
    await expect(page.locator('#downloadMapBtn')).toBeEnabled();
  });

  test('selected point exposes all navigation actions',async({page})=>{
    await openApp(page);
    await downloadFixtureRace(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    await page.locator('.point-row').first().locator('.point-row-copy').click();
    for(const id of ['googleMapsBtn','yandexMapsBtn','mapsMeBtn','sharePointBtn','copyCoordsBtn','favoritePointBtn']){
      await expect(page.locator('#'+id)).toBeVisible();
    }
  });

  test('spectator compass section is present for selected point',async({page})=>{
    await openApp(page);
    await downloadFixtureRace(page);
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    await page.locator('.point-row').first().locator('.point-row-copy').click();
    const compass=page.locator('#spectatorCompass');
    await expect(compass).toBeVisible();
    await compass.locator('summary').click();
    await expect(page.locator('#compassEnableBtn')).toBeVisible();
  });
});
