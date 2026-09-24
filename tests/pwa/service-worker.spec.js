import { test, expect } from '@playwright/test';

async function waitForWorker(page){
  return page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.ready;
    if(!registration.active) throw new Error('Service worker is not active');
    return {
      scope:registration.scope,
      scriptURL:registration.active.scriptURL,
      state:registration.active.state
    };
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
      if(!shell) return {shell:null,cached:[]};
      const cache=await caches.open(shell);
      const paths=[
        '/index.html',
        '/src/app.js',
        '/vendor/maplibre-gl/maplibre-gl.mjs',
        '/vendor/maplibre-gl/maplibre-gl.css',
        '/vendor/pmtiles/pmtiles.js'
      ];
      const cached=[];
      for(const path of paths) cached.push(Boolean(await cache.match(path)));
      return {shell,cached};
    });

    expect(result.shell).toBe('rfm-companion-v061-sortovala');
    expect(result.cached).toEqual([true,true,true,true,true]);
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

  test('does not require unpkg resources in the production document',async({page})=>{
    const requests=[];
    page.on('request',request=>requests.push(request.url()));
    await page.goto('/');
    await waitForWorker(page);
    expect(requests.some(url=>url.includes('unpkg.com'))).toBe(false);
  });
});
