import { test, expect } from '@playwright/test';
import { openApp, seedFixtureRace, openMapWithAcceptedSafety } from './helpers.js';

for (const theme of ['light', 'dark']) {
  test(`map controls and More rows follow the mobile composition (${theme})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page);
    await seedFixtureRace(page, {
      pointProperties: {
        photo: '/assets/safety/corner-jump.webp',
        rating: '4.8',
        walking: '350 м от парковки',
      },
    });
    await openMapWithAcceptedSafety(page);
    await page.evaluate(theme => (document.documentElement.dataset.theme = theme), theme);
    await expect(page.locator('.map-brand')).toContainText('RALLY FANS');
    await expect(page.locator('.map-brand em')).toHaveText('MAP');
    await expect(page.locator('.bottom-tabbar button.active')).toHaveCSS(
      'color',
      'rgb(240, 82, 23)',
    );
    await expect(page.locator('.bottom-tabbar button.active')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await page.getByRole('combobox', { name: 'Гонка на карте' }).focus();
    await expect(page.locator('.map-rally-picker')).toHaveCSS('outline-style', 'solid');
    await expect(page.locator('.map-rally-picker')).toHaveCSS('outline-width', '2px');
    await page.getByRole('combobox', { name: 'Гонка на карте' }).blur();
    const map = await page.locator('.map-screen > .map').boundingBox();
    expect(map.height).toBeCloseTo(844, 0);
    const header = await page.locator('.map-floating-header').boundingBox();
    const tools = await page.getByRole('button', { name: 'Инструменты карты' }).boundingBox();
    expect(header.height).toBeLessThan(65);
    expect(header.x + header.width).toBeLessThan(tools.x);
    expect(tools.width).toBe(42);
    await page.getByRole('button', { name: 'Инструменты карты' }).click();
    await page.getByText('ГДЕ СМОТРЕТЬ?').click();
    await page
      .locator('.point-row')
      .filter({ hasText: 'Смотровая точка' })
      .locator('.point-row-copy')
      .click();
    const sheet = page.locator('#pointActions');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('img')).toBeVisible();
    await expect(sheet).toContainText('350 м от парковки');
    const cta = page.getByRole('button', { name: 'Показать детали' });
    await expect(cta).toHaveCSS('background-color', 'rgb(240, 82, 23)');
    const sheetBox = await sheet.boundingBox();
    const ctaBox = await cta.boundingBox();
    expect(ctaBox.width).toBeGreaterThan(sheetBox.width * 0.85);
    const tabs = await page.locator('.bottom-tabbar').boundingBox();
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(tabs.y);
    await page.screenshot({ path: testInfo.outputPath(`map-${theme}.png`) });
    await cta.click();
    await expect(page.locator('#mapPointDetails')).toBeVisible();
    await page.getByRole('button', { name: 'Ещё', exact: true }).click();
    const gaps = await page.locator('.more-menu-grid').evaluateAll(groups =>
      groups.flatMap(group => {
        const rows = [...group.querySelectorAll('.more-menu-row')];
        return rows
          .slice(1)
          .map(
            (row, i) => row.getBoundingClientRect().top - rows[i].getBoundingClientRect().bottom,
          );
      }),
    );
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(Math.abs(gap)).toBeLessThan(1);
    if (theme === 'dark')
      await expect(page.locator('.more-menu-grid').first()).toHaveCSS(
        'background-color',
        'rgb(23, 26, 31)',
      );
    await page.screenshot({ path: testInfo.outputPath(`more-${theme}.png`), fullPage: true });
  });
}
