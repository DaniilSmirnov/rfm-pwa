import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const release=JSON.parse(readFileSync(new URL('../../version.json',import.meta.url),'utf8'));
const expectedShell=`rfm-companion-v${String(release.version).replace(/\D/g,'')}-${String(release.codename).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;

async function waitForWorker(page){
  return page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.ready;
    const worker=registration.active;
    if(!worker) throw new Error('Service worker is not active');
    if(worker.state!=='activated'){
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error(`Service worker stayed ${worker.state}`)),5000);
        worker.addEventListener('statechange',()=>{
          if(worker.state==='activated'){
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }
    return {scope:registration.scope,scriptURL:worker.scriptURL,state:worker.state};
  });
}

test.describe('production service worker lifecycle',()=>{
  test('installs and precaches same-origin application shell',async({page})=>{
    await page.goto('/');
    const worker=await waitForWorker(page);
    expect(worker.state).toBe('activated');
    expect(worker.scriptURL).toContain('/sw.js');

    const result=await page.evaluate(async()=>{
      const names=await caches.keys();
      const shell=names.find(name=>name.startsWith('rfm-companion-v'));
      if(!shell) return {shell:null,paths:[]};
      const cache=await caches.open(shell);
      const paths=(await cache.keys()).map(request=>new URL(request.url).pathname);
      return {shell,paths};
    });

    expect(result.shell).toBe(expectedShell);
    expect(result.paths).toContain('/index.html');
    expect(result.paths).toContain('/vendor/maplibre-gl/maplibre-gl.mjs');
    expect(result.paths).toContain('/vendor/maplibre-gl/maplibre-gl.css');
    expect(result.paths).toContain('/vendor/pmtiles/pmtiles.js');
    expect(result.paths.some(path=>/^\/assets\/.*\.js$/.test(path))).toBe(true);
    expect(result.paths.some(path=>/^\/assets\/.*\.css$/.test(path))).toBe(true);
    expect(result.paths).not.toContain('/src/app.js');
  });

  test('removes stale shell caches during activation',async({page})=>{
    await page.goto('/version.json');
    await page.evaluate(async()=>{await caches.open('rfm-companion-v000-stale');});
    await page.goto('/');
    await waitForWorker(page);
    await expect.poll(()=>page.evaluate(async()=>(await caches.keys()).includes('rfm-companion-v000-stale'))).toBe(false);
  });

  test('reloads the application shell while fully offline',async({page,context})=>{
    await page.goto('/');
    await waitForWorker(page);
    await page.reload();
    await expect(page.locator('body')).toBeVisible();

    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByText('RALLY FANS MAP · OFFLINE')).toBeVisible();
    await expect(page.locator('#networkBadge')).toHaveText('офлайн');
  });

  test('reopens the application from cache after the last page is closed and the browser goes offline',async({page,context})=>{
    await page.goto('/');
    await waitForWorker(page);
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByText('RALLY FANS MAP · OFFLINE')).toBeVisible();

    await page.close();
    await context.setOffline(true);

    const reopened=await context.newPage();
    await reopened.goto('/',{waitUntil:'domcontentloaded'});
    await expect(reopened.getByText('RALLY FANS MAP · OFFLINE')).toBeVisible();
    await expect(reopened.locator('#networkBadge')).toHaveText('офлайн');
  });

  test('does not require unpkg resources in the production document',async({page})=>{
    const requests=[];
    page.on('request',request=>requests.push(request.url()));
    await page.goto('/');
    await waitForWorker(page);
    expect(requests.some(url=>url.includes('unpkg.com'))).toBe(false);
  });
});
