import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openApp, raceFixture, secondRace } from './helpers.js';

const release=JSON.parse(readFileSync(new URL('../../version.json',import.meta.url),'utf8'));

test.describe('app shell and catalog',()=>{
  test('renders product identity and version',async({page})=>{
    await openApp(page);
    await expect(page).toHaveTitle('Rally Fans Map Offline');
    await expect(page.locator('.app-footer')).toBeHidden();
    await page.getByRole('button',{name:'Ещё'}).click();
    await expect(page.locator('.app-footer')).toContainText(release.version);
    await expect(page.locator('.header-brand')).toContainText('Rally Fans Map');
  });

  test('shows browser PWA installation CTA',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await expect(page.locator('#pwaInstallPrompt')).toBeVisible();
    await expect(page.locator('#installBtn')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-pwa-context','browser');
  });

  test('shows online network badge',async({page})=>{
    await openApp(page);
    await expect(page.locator('#networkBadge')).toHaveText('онлайн');
    await expect(page.locator('#networkBadge')).toHaveClass(/online/);
  });

  test('shows only closest race by default',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await expect(page.locator('#catalogList')).toContainText(raceFixture.name);
    await expect(page.locator('#catalogList')).not.toContainText(secondRace.name);
  });

  test('catalog search reveals races outside week window',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.locator('#catalogSearch').fill('Пермь');
    await expect(page.locator('#catalogList')).toContainText(secondRace.name);
    await expect(page.locator('#catalogList')).toContainText('Пермь');
  });

  test('catalog search can find by race name',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.locator('#catalogSearch').fill('Far Future');
    await expect(page.locator('.catalog-row')).toHaveCount(1);
    await expect(page.locator('.catalog-row')).toContainText(secondRace.name);
  });

  test('catalog search shows empty state',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.locator('#catalogSearch').fill('does-not-exist');
    await expect(page.locator('#catalogList')).toContainText('Ничего не найдено');
  });

  test('manual import section is available',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await expect(page.getByText('РУЧНОЙ ИМПОРТ')).toBeVisible();
    await expect(page.locator('label[for="fileInput"]')).toContainText('Импортировать файл');
  });

  test('offline map controls start disabled without selected package',async({page})=>{
    await openApp(page);
    await expect(page.locator('#downloadMapBtn')).toBeDisabled();
    await expect(page.locator('#mapSubtitle')).toContainText('Выбери сохранённую гонку');
  });

  test('refresh catalog button keeps catalog operational',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.locator('#refreshCatalogBtn').click();
    await expect(page.locator('#catalogStatus')).toContainText('2 гонок');
    await expect(page.locator('#catalogList')).toContainText(raceFixture.name);
  });

  test('opens boot diagnostics after five logo taps and reads local storage on demand',async({page})=>{
    await openApp(page);
    for(let i=0;i<5;i++) await page.locator('#headerLogo').click();
    await expect(page.locator('#bootDiagnosticsModal')).toBeVisible();
    await page.locator('#bootDiagnosticsRefreshPackages').click();
    await page.locator('#bootDiagnosticsRefresh').click();
    await expect(page.locator('#bootDiagnosticsMeta')).toContainText('Локальные данные:');
    await expect(page.locator('#bootDiagnosticsMeta')).toContainText('rallyfans-offline');
    await expect(page.locator('#bootDiagnosticsExport')).toBeVisible();
  });
});
