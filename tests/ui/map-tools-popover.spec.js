import { test, expect } from '@playwright/test';
import { openApp, openMapWithAcceptedSafety, seedFixtureRace } from './helpers.js';

for (const theme of ['light', 'dark']) {
  test(`map tools and favorites drawers preserve switching and dismissal (${theme})`, async ({
    page,
  }) => {
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

    const favoritesTrigger = page.getByRole('button', { name: 'Избранное' });
    await favoritesTrigger.click();
    const favoritesDrawer = page.locator('#mapFavoritesDrawer');
    await expect(favoritesDrawer).toBeVisible();
    await expect(favoritesTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toBeHidden();
    await expect(favoritesDrawer.getByText('ИЗБРАННЫЕ ТОЧКИ')).toBeVisible();

    const carTrigger = page.getByRole('button', { name: 'Моя машина' });
    await carTrigger.click();
    const carDrawer = page.locator('#mapCarDrawer');
    await expect(carDrawer).toBeVisible();
    await expect(carTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(favoritesDrawer).toBeHidden();
    await expect(carDrawer.getByText('ГДЕ МАШИНА?')).toBeVisible();

    await trigger.click();
    await expect(drawer).toBeVisible();
    await expect(favoritesDrawer).toBeHidden();
    await expect(carDrawer).toBeHidden();

    const viewport = page.viewportSize();
    await page.mouse.click(viewport.width - 12, 300);
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}
