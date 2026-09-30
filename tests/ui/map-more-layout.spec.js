import { test, expect } from '@playwright/test';
import { openApp, seedFixtureRace, openMapWithAcceptedSafety, selectMapPoint } from './helpers.js';

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
    const mapLogo = page.locator('.map-brand-logo');
    await expect(mapLogo).toHaveAttribute('src', /\/rfm\/icon\.png\?v=\d+/);
    await expect(mapLogo).toHaveAttribute('alt', 'Rally Fans Map');
    await expect(mapLogo).toBeVisible();
    await expect(page.locator('.map-brand')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('.map-brand')).toHaveCSS('padding', '0px');
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
    await selectMapPoint(page);
    const sheet = page.locator('#pointActions');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.map-point-sheet-grabber')).toBeVisible();
    await expect(sheet.locator('img')).toBeVisible();
    await expect(sheet).toContainText('350 м от парковки');
    await expect(page.locator('#mapPointDetails')).toBeHidden();
    const compactSheetBox = await sheet.boundingBox();
    expect(compactSheetBox.x).toBe(0);
    expect(compactSheetBox.width).toBeCloseTo(await page.evaluate(() => innerWidth), 0);
    await expect(page.locator('#mapPointSheetBackdrop')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await expect(page.locator('#mapPointSheetBackdrop')).toHaveCSS('pointer-events', 'none');
    await expect(sheet).toHaveCSS('touch-action', 'none');
    const sheetHandle = page.getByRole('button', { name: 'Развернуть карточку точки' });
    if (testInfo.project.name === 'webkit-iphone') {
      await sheetHandle.click();
    } else {
      const gestureSurface = sheet.locator('.point-actions-copy');
      const gestureBox = await gestureSurface.boundingBox();
      await page.mouse.move(gestureBox.x + gestureBox.width / 2, gestureBox.y + 24);
      await page.mouse.down();
      await page.mouse.move(gestureBox.x + gestureBox.width / 2, gestureBox.y - 72, { steps: 4 });
      await page.mouse.up();
    }
    await expect(page.locator('#mapPointDetails')).toBeVisible();
    await expect(page.locator('#mapPointSheetBackdrop')).toHaveCSS('pointer-events', 'auto');
    await expect(page.locator('#mapPointSheetBackdrop')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    const sheetBox = await sheet.boundingBox();
    expect(sheetBox.height).toBeGreaterThan(120);
    const tabs = await page.locator('.bottom-tabbar').boundingBox();
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(tabs.y);
    await page.screenshot({ path: testInfo.outputPath(`map-${theme}.png`) });
    await page.locator('#mapPointSheetBackdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#pointActions')).toBeHidden();
    await expect(page.locator('#mapPointSheetBackdrop')).toBeHidden();
    await selectMapPoint(page);
    await expect(page.locator('#pointActions')).toBeVisible();
    await page.getByRole('button', { name: 'Развернуть карточку точки' }).click();
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

test('supports real touch swipes on the mobile point sheet', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'requires Chromium touch input');
  await openApp(page);
  await seedFixtureRace(page, {
    pointProperties: {
      photo: '/assets/safety/corner-jump.webp',
      description: 'Подробности точки. '.repeat(80),
    },
  });
  await openMapWithAcceptedSafety(page);
  await page.getByRole('button', { name: 'Инструменты карты' }).click();
  await page.getByText('ГДЕ СМОТРЕТЬ?').click();
  await page
    .locator('.point-row')
    .filter({ hasText: 'Смотровая точка' })
    .locator('.point-row-copy')
    .click();
  const sheet = page.locator('#pointActions');
  await expect(sheet).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (box, endY, startOffset = 24) => {
    const x = box.x + box.width / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: box.y + startOffset, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: endY, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const summaryBox = await sheet.locator('.point-actions-copy').boundingBox();
  await swipe(summaryBox, summaryBox.y - 72);
  await expect(page.locator('#mapPointDetails')).toBeVisible();
  const expandedSheetBox = await sheet.boundingBox();
  const expandedScrollState = await page.evaluate(() => {
    const currentSheet = document.querySelector('#pointActions');
    currentSheet.scrollTop = Math.min(48, currentSheet.scrollHeight - currentSheet.clientHeight);
    return {
      scrollTop: currentSheet.scrollTop,
      canScroll: currentSheet.scrollHeight > currentSheet.clientHeight,
    };
  });
  expect(expandedScrollState.canScroll).toBe(true);
  expect(expandedScrollState.scrollTop).toBeGreaterThan(0);
  await swipe(expandedSheetBox, expandedSheetBox.y + 172, 100);
  await expect(page.locator('#mapPointDetails')).toBeVisible();
  await page.evaluate(() => {
    document.querySelector('#pointActions').scrollTop = 0;
  });
  const topExpandedSheetBox = await sheet.boundingBox();
  await swipe(topExpandedSheetBox, topExpandedSheetBox.y + 172, 100);
  await expect(page.locator('#mapPointDetails')).toBeHidden();
  await expect(sheet).toBeVisible();
  const compactSheetBox = await sheet.boundingBox();
  await swipe(compactSheetBox, compactSheetBox.y + 144, 72);
  await expect(sheet).toBeHidden();
});
