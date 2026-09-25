import {test,expect} from '@playwright/test';
import {openApp} from './helpers.js';

test('switches between offline-first main tabs',async({page})=>{
  await openApp(page);
  await expect(page.getByRole('navigation',{name:'Основная навигация'})).toBeVisible();
  await expect(page.locator('.bottom-tabbar svg')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'Сегодня'})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'Карта'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-active-tab','map');
  await page.getByRole('button',{name:'Ещё'}).click();
  await expect(page.getByRole('button',{name:'Мои гонки'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Все результаты'})).toBeVisible();
  await expect(page.locator('#crewResults>.crew-results-section>.section-head')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-active-tab','more');
});
