import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function getBounds(page,selector){
  return page.locator(selector).evaluate(element=>{
    const rect=element.getBoundingClientRect();
    return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};
  });
}

test('keeps the brand centered in the header independently of the status badge',async({page})=>{
  await openApp(page);

  const header=await getBounds(page,'.topbar');
  const brand=await getBounds(page,'.header-brand');
  const actions=await page.locator('.top-actions').evaluate(element=>{
    const rect=element.getBoundingClientRect();
    return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};
  });
  const headerCenter=(header.left+header.right)/2;
  const brandCenter=(brand.left+brand.right)/2;

  expect(header.height).toBeGreaterThan(0);
  expect(Math.abs(brandCenter-headerCenter)).toBeLessThanOrEqual(1);
  const overlapsHorizontally=brand.left<actions.right&&brand.right>actions.left;
  const overlapsVertically=brand.top<actions.bottom&&brand.bottom>actions.top;
  expect(overlapsHorizontally&&overlapsVertically).toBe(false);
});

test('renders More content before the footer and keeps the footer above the fixed tab bar',async({page})=>{
  await openApp(page);
  await page.getByRole('button',{name:'Ещё'}).click();

  const footer=page.locator('.app-footer');
  const menu=page.locator('.more-menu');
  await expect(menu.getByRole('button',{name:'Мои гонки'})).toBeVisible();
  await expect(menu.getByRole('button',{name:/Настройки и диагностика/})).toBeVisible();
  await expect(footer).toBeVisible();
  expect((await getBounds(page,'.more-menu')).bottom)
    .toBeLessThanOrEqual((await getBounds(page,'.app-footer')).top);

  await page.getByRole('button',{name:/Настройки и диагностика/}).click();
  await expect(page.getByRole('heading',{name:'Настройки и диагностика'})).toBeVisible();
  expect((await getBounds(page,'.settings-screen')).bottom)
    .toBeLessThanOrEqual((await getBounds(page,'.app-footer')).top);

  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const footerBottom=await page.locator('.app-footer').evaluate(element=>element.getBoundingClientRect().bottom);
  const tabBarTop=await page.locator('.bottom-tabbar').evaluate(element=>element.getBoundingClientRect().top);
  expect(footerBottom).toBeLessThanOrEqual(tabBarTop);
  await expect(page.getByText(/Companion v/)).toBeInViewport();
});
