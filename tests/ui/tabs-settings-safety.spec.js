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

  test('switches the app theme from settings and remembers it after reload',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.getByRole('button',{name:/Настройки и диагностика/}).click();
    await page.getByRole('button',{name:'☾ Тёмная'}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#111318');
    await expect(page.getByRole('button',{name:'☾ Тёмная'})).toHaveAttribute('aria-pressed','true');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.getByRole('button',{name:/Настройки и диагностика/}).click();
    await page.getByRole('button',{name:'☀ Светлая'}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','light');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#f5f5f5');
  });

  test('opens the safety rules as a full-screen reader from settings',async({page})=>{
    await openApp(page);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.getByRole('button',{name:/Настройки и диагностика/}).click();
    await page.getByRole('button',{name:'Открыть правила безопасности'}).click();
    const dialog=page.getByRole('dialog',{name:'Безопасность'});
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
    const gate=page.getByRole('dialog',{name:'Безопасность'});
    await expect(gate).toBeVisible();
    await expect(page.locator('#mapSection')).toHaveCSS('filter',/blur/);
    const accept=page.locator('.safety-accept');
    if(await accept.isDisabled()){
      await page.locator('.safety-gate-content').evaluate(node=>{node.scrollTop=node.scrollHeight;node.dispatchEvent(new Event('scroll'));});
    }
    await expect(accept).toBeEnabled();
    await accept.click();
    await expect(gate).toBeHidden();
    await expect(page.locator('#mapSection')).not.toHaveCSS('filter',/blur\(/);
    expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('rfm:safety-accepted:v1:')))).toBe(true);
  });

  test('renders the safety leaflet as React content with separate illustrations',async({page})=>{
    await openApp(page);
    await seedFixtureRace(page);
    await page.getByRole('button',{name:'Карта'}).click();
    const gate=page.getByRole('dialog',{name:'Безопасность'});
    await expect(gate).toBeVisible();
    await expect(gate.locator('.safety-memo')).toBeVisible();
    await expect(gate.getByRole('heading',{name:'Опасные зоны'})).toBeVisible();
    await expect(gate.getByRole('heading',{name:'Как вести себя на этапе'})).toBeVisible();
    await expect(gate.locator('.safety-danger-example')).toHaveCount(5);
    await expect(gate.locator('.safety-stage-card')).toHaveCount(3);
    const mapImage=gate.locator('.safety-map-image');
    await expect(mapImage).toBeVisible();
    await expect.poll(()=>mapImage.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.getByRole('button',{name:/Настройки и диагностика/}).click();
    await page.getByRole('button',{name:'Открыть правила безопасности'}).click();
    const fullScreen=page.getByRole('dialog',{name:'Безопасность'});
    await expect(fullScreen).toHaveClass(/safety-gate-fullscreen/);
    await expect(fullScreen.locator('.safety-memo')).toBeVisible();
  });

  test('adapts the safety leaflet surfaces to the selected app theme',async({page})=>{
    await openApp(page);
    await seedFixtureRace(page);
    await page.getByRole('button',{name:'Карта'}).click();
    const memo=page.locator('.safety-memo');
    await expect(memo).toBeVisible();

    const lightBackground=await memo.evaluate(element=>getComputedStyle(element).backgroundColor);
    const lightPanel=await page.locator('.safety-main-rules').evaluate(element=>getComputedStyle(element).backgroundColor);
    await page.getByRole('button',{name:'Ещё'}).click();
    await page.getByRole('button',{name:/Настройки и диагностика/}).click();
    await page.getByRole('button',{name:'☾ Тёмная'}).click();
    await page.getByRole('button',{name:'Карта'}).click();
    const darkBackground=await memo.evaluate(element=>getComputedStyle(element).backgroundColor);
    const darkPanel=await page.locator('.safety-main-rules').evaluate(element=>getComputedStyle(element).backgroundColor);

    expect(darkBackground).not.toBe(lightBackground);
    expect(darkPanel).not.toBe(lightPanel);
    expect(darkBackground).toBe('rgb(23, 31, 40)');
  });

  test('preserves the map scroll position when switching tabs',async({page})=>{
    await openApp(page);
    await seedFixtureRace(page);
    await page.getByRole('button',{name:'Карта'}).click();
    const accept=page.locator('.safety-accept');
    if(await accept.isVisible()){
      if(await accept.isDisabled())await page.locator('.safety-gate-content').evaluate(node=>{node.scrollTop=node.scrollHeight;node.dispatchEvent(new Event('scroll'));});
      await accept.click();
    }
    await page.evaluate(()=>window.scrollTo(0,250));
    const before=await page.evaluate(()=>window.scrollY);
    expect(before).toBeGreaterThan(0);
    await page.getByRole('button',{name:'Сегодня'}).click();
    await page.getByRole('button',{name:'Карта'}).click();
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeCloseTo(before,0);
  });

  test('disables page pinch zoom',async({page})=>{
    await openApp(page);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content',/user-scalable=no/);
  });
});
