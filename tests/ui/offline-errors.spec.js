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

  test('failed offline map update keeps the previous revision active',async({page,browserName})=>{
    test.skip(browserName!=='chromium','OPFS/IndexedDB map revision behavior is covered in Chromium UI run');
    await openApp(page);
    await downloadFixtureRace(page);
    const before=await page.evaluate(()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('rallyfans-offline',2);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        const tx=db.transaction('packages','readonly');
        const get=tx.objectStore('packages').get('race-101');
        get.onsuccess=()=>resolve(get.result?.offlineMap||null);
        get.onerror=()=>reject(get.error);
      };
    }));
    expect(before?.ready).toBe(true);
    await page.evaluate(()=>{window.__pmtilesFail=true;});
    const dialog=page.waitForEvent('dialog');
    await page.locator('#downloadMapBtn').click();
    await (await dialog).dismiss();
    await expect(page.locator('#offlineMapStatus')).toContainText('Не удалось скачать карту');
    const after=await page.evaluate(()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('rallyfans-offline',2);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        const tx=db.transaction('packages','readonly');
        const get=tx.objectStore('packages').get('race-101');
        get.onsuccess=()=>resolve(get.result?.offlineMap||null);
        get.onerror=()=>reject(get.error);
      };
    }));
    expect(after?.storageId).toBe(before.storageId);
    await expect(page.locator('#deleteMapBtn')).toBeVisible();
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
