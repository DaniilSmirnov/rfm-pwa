import {test,expect} from '@playwright/test';
import {openApp,seedFixtureRace,secondRace} from './helpers.js';

test.describe('Today tab and settings flows',()=>{
  test('announces the nearest upcoming race and offers its Rally Pack',async({page})=>{
    await openApp(page,{catalog:[secondRace]});
    await expect(page.locator('.today-race-card')).toContainText('СЛЕДУЮЩАЯ ГОНКА');
    await expect(page.locator('.today-race-card')).toContainText('Rally Far Future');
    await expect(page.locator('.today-race-card button')).toContainText('Скачать Rally Pack');
  });

  test('moves settings and diagnostics to a separate screen in More',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.getByRole('button',{name:/Настройки и диагностика/}).click();
    await expect(page.getByRole('heading',{name:'Настройки и диагностика'})).toBeVisible();
    await expect(page.locator('#settingsSection')).toBeVisible();
    await expect(page.getByRole('button',{name:'Открыть диагностику приложения'})).toBeVisible();
    await expect(page.locator('#catalogSection')).toBeHidden();
  });

  test('opens the safety rules as a full-screen reader from settings',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.getByRole('button',{name:/Настройки и диагностика/}).click();
    await page.getByRole('button',{name:'Открыть правила безопасности'}).click();
    const dialog=page.getByRole('dialog',{name:'Правила безопасности'});
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/safety-gate-fullscreen/);
    await expect(dialog).toHaveCSS('top','0px');
    await expect(dialog).toHaveCSS('bottom','0px');
    await page.getByRole('button',{name:'Закрыть правила безопасности'}).click();
    await expect(dialog).toBeHidden();
  });

  test('gates and blurs the map until the safety rules have been accepted',async({page})=>{
    await openApp(page);
    await seedFixtureRace(page);
    await page.getByRole('button',{name:'Карта'}).click();
    const gate=page.getByRole('dialog',{name:'Правила безопасности'});
    await expect(gate).toBeVisible();
    await expect(page.locator('#mapSection')).toHaveCSS('filter',/blur/);
    const accept=page.getByRole('button',{name:/открыть карту/i});
    if(await accept.isDisabled()){
      await page.locator('.safety-gate-content').evaluate(node=>{node.scrollTop=node.scrollHeight;node.dispatchEvent(new Event('scroll'));});
    }
    await expect(accept).toBeEnabled();
    await accept.click();
    await expect(gate).toBeHidden();
    await expect(page.locator('#mapSection')).not.toHaveCSS('filter',/blur\(/);
    expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('rfm:safety-accepted:v1:')))).toBe(true);
  });

  test('shows the organizer leaflet in the safety gate and opens it full screen',async({page})=>{
    await openApp(page);
    await seedFixtureRace(page);
    await page.getByRole('button',{name:'Карта'}).click();
    const leaflet=page.getByRole('img',{name:'Памятка по безопасности от организатора'}).first();
    await expect(leaflet).toBeVisible();
    await expect(leaflet).toHaveJSProperty('naturalWidth',1);
    await page.getByRole('button',{name:'Открыть памятку по безопасности на весь экран'}).click();
    const viewer=page.getByRole('dialog',{name:'Памятка по безопасности на весь экран'});
    await expect(viewer).toBeVisible();
    await expect(viewer).toHaveCSS('position','fixed');
    await page.getByRole('button',{name:'Закрыть памятку'}).click();
    await expect(viewer).toBeHidden();
  });

  test('preserves the map scroll position when switching tabs',async({page})=>{
    await openApp(page);
    await seedFixtureRace(page);
    await page.getByRole('button',{name:'Карта'}).click();
    const accept=page.getByRole('button',{name:/открыть карту/i});
    if(await accept.isVisible()){
      if(await accept.isDisabled())await page.locator('.safety-gate-content').evaluate(node=>{node.scrollTop=node.scrollHeight;node.dispatchEvent(new Event('scroll'));});
      await accept.click();
    }
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    const before=await page.evaluate(()=>window.scrollY);
    await page.getByRole('button',{name:'Сегодня'}).click();
    await page.getByRole('button',{name:'Карта'}).click();
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThanOrEqual(before-2);
  });

  test('disables page pinch zoom',async({page})=>{
    await openApp(page);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content',/user-scalable=no/);
  });
});
