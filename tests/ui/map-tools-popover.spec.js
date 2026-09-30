import { test, expect } from '@playwright/test';
import { openApp, openMapWithAcceptedSafety, seedFixtureRace } from './helpers.js';

for (const theme of ['light', 'dark']) {
  test(`map tools drawer preserves positioning and dismissal (${theme})`, async ({ page }) => {
    await openApp(page);
    await seedFixtureRace(page);
    await openMapWithAcceptedSafety(page);
    await page.evaluate(themeName => (document.documentElement.dataset.theme = themeName), theme);

    const trigger = page.getByRole('button', { name: 'Инструменты карты' });
    await trigger.focus();
    await trigger.click();

    const drawer = page.locator('#mapToolsDrawer');
    await expect(drawer).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#downloadMapBtn')).toBeEnabled();
    await expect(drawer).toHaveCSS('position', 'absolute');

    await page.locator('.map-screen > .map').click({ position: { x: 20, y: 300 } });
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}
