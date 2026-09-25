import { test, expect } from '@playwright/test';
import { openApp, installAppMocks, raceFixture, secondRace, downloadFixtureRace } from './helpers.js';

test.describe('offline, import and failure states',()=>{
  test('shows API health failure',async({page})=>{
    await openApp(page,{healthStatus:503});
    await expect(page.locator('#catalogStatus')).toContainText('API недоступен');
  });

  test('shows catalog failure after healthy proxy',async({page})=>{
    await openApp(page,{catalogStatus:500});
    await expect(page.locator('#catalogStatus')).toContainText('API недоступен');
  });

  test('updates network badge when connectivity disappears after launch',async({page})=>{
    await openApp(page);
    await expect(page.locator('#networkBadge')).toHaveText('онлайн');

    await page.evaluate(()=>{
      window.__rfmTestOnline=false;
      window.dispatchEvent(new Event('offline'));
    });

    await expect(page.locator('#networkBadge')).toHaveText('офлайн');
    await expect(page.locator('#networkBadge')).toHaveClass(/offline/);
    await expect(page.locator('#catalogStatus')).toContainText('Офлайн');
  });

  test('shows offline catalog state when navigator is offline',async({page})=>{
    await openApp(page,{online:false});
    await expect(page.locator('#networkBadge')).toHaveText('офлайн');
    await expect(page.locator('#catalogStatus')).toContainText('Офлайн');
  });

  test('shows no-nearby-races message without search',async({page})=>{
    await openApp(page,{catalog:[secondRace]});
    await expect(page.locator('#catalogList')).toContainText('Нет гонок в пределах недели');
  });

  test('manual GeoJSON import creates saved package',async({page})=>{
    await openApp(page);
    const data={
      name:'Imported Test',
      type:'FeatureCollection',
      features:[{type:'Feature',properties:{name:'Imported point'},geometry:{type:'Point',coordinates:[30.1,60.1]}}]
    };
    await page.locator('#fileInput').setInputFiles({
      name:'import.geojson',
      mimeType:'application/geo+json',
      buffer:Buffer.from(JSON.stringify(data))
    });
    await expect(page.locator('#packageList')).toContainText('Imported Test');
    await expect(page.locator('#mapTitle')).toHaveText('Imported Test');
  });

  test('invalid manual JSON shows an error dialog',async({page})=>{
    await openApp(page);
    const dialogPromise=page.waitForEvent('dialog');
    await page.locator('#fileInput').setInputFiles({
      name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')
    });
    const dialog=await dialogPromise;
    expect(dialog.message()).toContain('Не удалось импортировать');
    await dialog.dismiss();
  });

  test('saved race survives page reload through IndexedDB',async({page})=>{
    await openApp(page);
    await downloadFixtureRace(page);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#packageList')).toContainText(raceFixture.name);
  });

  test('offline map can be downloaded with PMTiles stub',async({page,browserName})=>{
    test.skip(browserName!=='chromium','OPFS/IndexedDB map download is covered in Chromium UI run');
    await openApp(page);
    await downloadFixtureRace(page);
    await page.locator('#downloadMapBtn').click();
    await expect(page.locator('#offlineMapStatus')).toContainText('Офлайн-подложка готова',{timeout:20_000});
    await expect(page.locator('#deleteMapBtn')).toBeVisible();
  });

  test('downloaded offline map can be deleted',async({page,browserName})=>{
    test.skip(browserName!=='chromium','OPFS/IndexedDB map download is covered in Chromium UI run');
    await openApp(page);
    await downloadFixtureRace(page);
    await page.locator('#downloadMapBtn').click();
    await expect(page.locator('#offlineMapStatus')).toContainText('Офлайн-подложка готова',{timeout:20_000});
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#deleteMapBtn').click();
    await expect(page.locator('#offlineMapStatus')).toContainText('Будет скачано');
  });
});

test.describe('standalone launch detection',()=>{
  test('hides install prompt when launched as standalone',async({page})=>{
    await page.addInitScript(()=>{
      const original=window.matchMedia.bind(window);
      window.matchMedia=query=>{
        if(query.includes('display-mode: standalone')){
          return {matches:true,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}};
        }
        return original(query);
      };
    });
    await installAppMocks(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#pwaInstallPrompt')).toBeHidden();
    await expect(page.locator('#installBtn')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-pwa-context','app');
  });

  test('browser launch is explicitly marked as browser context',async({page})=>{
    await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-pwa-installed','false');
    await expect(page.locator('html')).toHaveAttribute('data-pwa-context','browser');
  });
});
