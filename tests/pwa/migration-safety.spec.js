import { test, expect } from '@playwright/test';

async function waitForAppWorker(page){
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
    return worker.scriptURL;
  });
}

async function seedSavedRace(page,{offlineMap=false,withAssets=false}={}){
  await page.evaluate(async({offlineMap,withAssets})=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('rallyfans-offline',2);
      request.onupgradeneeded=()=>{
        const database=request.result;
        if(!database.objectStoreNames.contains('packages')) database.createObjectStore('packages',{keyPath:'id'});
        if(!database.objectStoreNames.contains('maptiles')){
          const store=database.createObjectStore('maptiles',{keyPath:'key'});
          store.createIndex('raceId','raceId',{unique:false});
        }
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });

    const storageId='race-901@e2e-map';
    const pkg={
      id:'race-901',
      raceId:901,
      name:'Offline Migration Rally',
      savedAt:'2026-09-24T10:00:00.000Z',
      size:512,
      source:'e2e',
      original:{
        id:901,
        name:'Offline Migration Rally',
        schedule:[],
        coordinates:[{id:1,name:'Offline spectator point',coordinates:'61.700,30.690'}],
        results:[],
        lists:[],
        how_it_was:'',
        ...(withAssets?{
          image:'hero.svg',
          mapsimg:'organizer-map.svg',
          safety_leaflet:'safety.svg'
        }:{})
      },
      summary:{
        category:'test',
        stage:'migration',
        status:'saved',
        dates:'26.09.2026',
        city:'Sortavala'
      },
      assetNames:withAssets?['hero.svg','organizer-map.svg','safety.svg']:[],
      geojson:{
        type:'FeatureCollection',
        features:[{
          type:'Feature',
          properties:{kind:'race-point',name:'Offline spectator point'},
          geometry:{type:'Point',coordinates:[30.69,61.70]}
        }]
      },
      ...(offlineMap?{
        offlineMap:{
          ready:true,
          storageId,
          tileCount:1,
          bytes:0,
          minZoom:6,
          maxZoom:14,
          bounds:{minLon:30.5,minLat:61.5,maxLon:30.9,maxLat:61.9},
          vectorLayers:[{id:'roads',fields:{}}],
          downloadedAt:'2026-09-24T10:00:00.000Z'
        }
      }:{})
    };

    await new Promise((resolve,reject)=>{
      const tx=db.transaction('packages','readwrite');
      tx.objectStore('packages').put(pkg);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
    });

    if(offlineMap){
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('maptiles','readwrite');
        tx.objectStore('maptiles').put({
          key:`${storageId}:14:9588:5820`,
          raceId:storageId,
          z:14,x:9588,y:5820,
          data:new ArrayBuffer(0),
          bytes:0
        });
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
      });
    }

    if(withAssets){
      const cache=await caches.open('rfm-race-assets-v1');
      const svg=name=>`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="white"/><text x="1" y="12" font-size="4">${name}</text></svg>`;
      for(const name of ['hero.svg','organizer-map.svg','safety.svg']){
        await cache.put(
          `/api/rallyfans/public/${encodeURIComponent(name)}`,
          new Response(svg(name),{status:200,headers:{'content-type':'image/svg+xml'}})
        );
      }
    }

    localStorage.setItem('rfm-favorites',JSON.stringify({
      'race-901':[{
        name:'Offline spectator point',
        lat:61.7,
        lon:30.69
      }]
    }));
  },{offlineMap,withAssets});
}

async function registerHarnessWorker(page,script){
  return page.evaluate(async script=>{
    const previous=navigator.serviceWorker.controller?.scriptURL||null;
    const registration=await navigator.serviceWorker.register(script,{scope:'/'});
    await navigator.serviceWorker.ready;
    if(registration.installing){
      await new Promise(resolve=>{
        const worker=registration.installing;
        const done=()=>worker.state==='activated'&&resolve();
        worker.addEventListener('statechange',done);
        done();
      });
    }
    if(!navigator.serviceWorker.controller || navigator.serviceWorker.controller.scriptURL===previous){
      await new Promise(resolve=>{
        const timeout=setTimeout(resolve,5000);
        navigator.serviceWorker.addEventListener('controllerchange',()=>{
          clearTimeout(timeout);
          resolve();
        },{once:true});
      });
    }
    return navigator.serviceWorker.controller?.scriptURL||null;
  },script);
}

test.describe('PWA migration safety',()=>{
  test('saved Rally Pack survives a cold start with the browser offline',async({page,context})=>{
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page);

    await page.close();
    await context.setOffline(true);

    const reopened=await context.newPage();
    await reopened.goto('/',{waitUntil:'domcontentloaded'});

    await expect(reopened.locator('#networkBadge')).toHaveText('офлайн');
    await expect(reopened.locator('#packageList')).toContainText('Offline Migration Rally');
    await expect(reopened.locator('#raceDetails')).toBeVisible();
    await expect(reopened.locator('#pointList')).toContainText('Offline spectator point');
    await expect(reopened.locator('#favoritesList')).toContainText('Offline spectator point');
  });

  test('reopens a saved offline map after restart without falling back to the online basemap',async({page,context})=>{
    await page.goto('/');
    await waitForAppWorker(page);
    await seedSavedRace(page,{offlineMap:true});

    await page.close();
    await context.setOffline(true);

    const requests=[];
    const reopened=await context.newPage();
    reopened.on('request',request=>requests.push(request.url()));
    await reopened.goto('/',{waitUntil:'domcontentloaded'});

    await expect(reopened.locator('#mapSubtitle')).toContainText('ИСПОЛЬЗУЕТСЯ офлайн-подложка');
    await expect(reopened.locator('#offlineMapDiag')).toContainText('локальная подложка 1 тайлов');
    await expect(reopened.locator('.maplibregl-canvas')).toBeVisible();
    expect(requests.some(url=>url.includes('/api/basemap.pmtiles'))).toBe(false);
  });

  test('a newly installed service worker takes control of an already open client',async({page})=>{
    await page.goto('/migration-harness.html');
    const first=await registerHarnessWorker(page,'/sw-upgrade-v1.js');
    expect(first).toContain('/sw-upgrade-v1.js');
    await expect.poll(()=>page.evaluate(()=>fetch('/__sw-version').then(r=>r.text()))).toBe('v1');

    const controllerChanges=await page.evaluate(async()=>{
      let changes=0;
      navigator.serviceWorker.addEventListener('controllerchange',()=>changes++);
      const registration=await navigator.serviceWorker.register('/sw-upgrade-v2.js',{scope:'/'});
      if(registration.installing){
        await new Promise((resolve,reject)=>{
          const worker=registration.installing;
          const timeout=setTimeout(()=>reject(new Error('v2 worker did not activate')),5000);
          worker.addEventListener('statechange',()=>{
            if(worker.state==='activated'){
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }
      await new Promise(resolve=>setTimeout(resolve,50));
      return changes;
    });

    expect(controllerChanges).toBeGreaterThanOrEqual(1);
    await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL||'')).toContain('/sw-upgrade-v2.js');
    await expect.poll(()=>page.evaluate(()=>fetch('/__sw-version').then(r=>r.text()))).toBe('v2');
  });

  test('application data survives a service worker version upgrade',async({page})=>{
    await page.goto('/migration-harness.html');
    await registerHarnessWorker(page,'/sw-upgrade-v1.js');

    await seedSavedRace(page);
    const before=await page.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('rallyfans-offline',2);
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('packages','readonly');
        const request=tx.objectStore('packages').get('race-901');
        request.onsuccess=()=>resolve({
          name:request.result?.name,
          favorites:localStorage.getItem('rfm-favorites')
        });
        request.onerror=()=>reject(request.error);
      });
    });

    await registerHarnessWorker(page,'/sw-upgrade-v2.js');
    await expect.poll(()=>page.evaluate(()=>fetch('/__sw-version').then(r=>r.text()))).toBe('v2');

    const after=await page.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('rallyfans-offline',2);
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('packages','readonly');
        const request=tx.objectStore('packages').get('race-901');
        request.onsuccess=()=>resolve({
          name:request.result?.name,
          favorites:localStorage.getItem('rfm-favorites')
        });
        request.onerror=()=>reject(request.error);
      });
    });

    expect(after).toEqual(before);
    expect(after.name).toBe('Offline Migration Rally');
    expect(after.favorites).toContain('Offline spectator point');
  });
});
