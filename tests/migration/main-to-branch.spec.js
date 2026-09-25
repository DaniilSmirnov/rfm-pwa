import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const branchRelease=JSON.parse(readFileSync(new URL('../../version.json',import.meta.url),'utf8'));

async function waitForActiveWorker(page){
  return page.evaluate(async()=>{
    const reg=await navigator.serviceWorker.ready;
    const worker=reg.active;
    if(!worker) throw new Error('No active service worker');
    if(worker.state!=='activated'){
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error(`Worker stayed ${worker.state}`)),8000);
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

async function seedPersistentData(page){
  return page.evaluate(async()=>{
    const storageId='race-migrate@map';
    const terrainId='race-migrate@terrain';
    const packageId='race-migrate';

    localStorage.setItem('rfm-favorite-points-v1',JSON.stringify({
      [packageId]:[{key:'61.700000:30.690000:Migration point',name:'Migration point',lat:61.7,lon:30.69,savedAt:'2026-09-24T10:00:00.000Z'}]
    }));
    localStorage.setItem('rfm-car-point-v1',JSON.stringify({name:'Машина',lat:61.71,lon:30.70,savedAt:'2026-09-24T10:00:00.000Z'}));
    localStorage.setItem('rfm-stage-push-subscriptions-v1',JSON.stringify({'9901':['stage-1','stage-2']}));
    localStorage.setItem('rfm-wallet-stage-passes-v1',JSON.stringify({'9901':['stage-1']}));

    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('rallyfans-offline');
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

    const pkg={
      id:packageId,
      raceId:9901,
      name:'Main Migration Rally',
      savedAt:'2026-09-24T10:00:00.000Z',
      size:1024,
      source:'migration-e2e',
      original:{
        id:9901,
        name:'Main Migration Rally',
        schedule:[],
        coordinates:[{id:1,name:'Migration point',coordinates:'61.700,30.690'}],
        results:[],
        lists:[],
        how_it_was:''
      },
      summary:{category:'test',stage:'migration',status:'saved',dates:'26.09.2026',city:'Sortavala'},
      assetNames:['migration.svg'],
      geojson:{
        type:'FeatureCollection',
        features:[{
          type:'Feature',
          properties:{kind:'race-point',name:'Migration point'},
          geometry:{type:'Point',coordinates:[30.69,61.70]}
        }]
      },
      offlineMap:{
        ready:true,
        storageId,
        tileCount:1,
        bytes:3,
        minZoom:6,
        maxZoom:14,
        bounds:{minLon:30.5,minLat:61.5,maxLon:30.9,maxLat:61.9},
        vectorLayers:[{id:'roads',fields:{}}],
        downloadedAt:'2026-09-24T10:00:00.000Z'
      },
      terrain:{
        ready:true,
        storageId:terrainId,
        tileCount:1,
        bytes:3,
        minZoom:6,
        maxZoom:12,
        tileSize:512,
        encoding:'terrarium',
        bounds:{minLon:30.5,minLat:61.5,maxLon:30.9,maxLat:61.9},
        downloadedAt:'2026-09-24T10:00:00.000Z'
      }
    };

    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['packages','maptiles'],'readwrite');
      tx.objectStore('packages').put(pkg);
      tx.objectStore('maptiles').put({
        key:'legacy-storage:7:77:88',
        raceId:'legacy-storage',
        z:7,x:77,y:88,
        data:new Uint8Array([9,8,7]).buffer,
        bytes:3
      });
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
    });

    let opfsSeeded=false;
    if(navigator.storage?.getDirectory){
      const root=await navigator.storage.getDirectory();
      const mapRoot=await root.getDirectoryHandle('rfm-maptiles',{create:true});
      const safe=value=>encodeURIComponent(String(value)).replace(/%/g,'_');

      async function writeTile(id,z,x,y,bytes){
        let dir=await mapRoot.getDirectoryHandle(safe(id),{create:true});
        dir=await dir.getDirectoryHandle(String(z),{create:true});
        dir=await dir.getDirectoryHandle(String(x),{create:true});
        const handle=await dir.getFileHandle(`${y}.pbf`,{create:true});
        const writable=await handle.createWritable();
        await writable.write(new Uint8Array(bytes));
        await writable.close();
      }

      await writeTile(storageId,14,9588,4599,[1,2,3]);
      await writeTile(terrainId,12,2397,1149,[4,5,6]);
      opfsSeeded=true;
    }

    const assetCache=await caches.open('rfm-race-assets-v1');
    await assetCache.put('/api/rallyfans/public/migration.svg',new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      {headers:{'content-type':'image/svg+xml'}}
    ));

    const periodic=await caches.open('rfm-periodic-data-v1');
    await periodic.put('/api/rallyfans/race/9901',new Response(JSON.stringify({id:9901,name:'Cached Migration Rally'}),{
      headers:{'content-type':'application/json'}
    }));

    return {
      packageId,
      storageId,
      terrainId,
      opfsSeeded,
      shellCaches:(await caches.keys()).filter(name=>name.startsWith('rfm-companion-'))
    };
  });
}

async function readPersistentState(page,seed){
  return page.evaluate(async seed=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('rallyfans-offline');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });

    const indexed=await new Promise((resolve,reject)=>{
      const tx=db.transaction(['packages','maptiles'],'readonly');
      const pkg=tx.objectStore('packages').get(seed.packageId);
      const tile=tx.objectStore('maptiles').get('legacy-storage:7:77:88');
      tx.oncomplete=()=>resolve({
        packageName:pkg.result?.name||null,
        packageOfflineStorageId:pkg.result?.offlineMap?.storageId||null,
        packageTerrainStorageId:pkg.result?.terrain?.storageId||null,
        legacyTileBytes:tile.result?.bytes||0
      });
      tx.onerror=()=>reject(tx.error);
    });

    let opfsMapBytes=null;
    let opfsTerrainBytes=null;
    if(seed.opfsSeeded && navigator.storage?.getDirectory){
      const safe=value=>encodeURIComponent(String(value)).replace(/%/g,'_');
      const root=await navigator.storage.getDirectory();
      const mapRoot=await root.getDirectoryHandle('rfm-maptiles');

      async function fileSize(id,z,x,y){
        let dir=await mapRoot.getDirectoryHandle(safe(id));
        dir=await dir.getDirectoryHandle(String(z));
        dir=await dir.getDirectoryHandle(String(x));
        const handle=await dir.getFileHandle(`${y}.pbf`);
        return (await handle.getFile()).size;
      }

      opfsMapBytes=await fileSize(seed.storageId,14,9588,4599);
      opfsTerrainBytes=await fileSize(seed.terrainId,12,2397,1149);
    }

    const assetCache=await caches.open('rfm-race-assets-v1');
    const periodic=await caches.open('rfm-periodic-data-v1');

    return {
      indexed,
      opfsMapBytes,
      opfsTerrainBytes,
      favorites:localStorage.getItem('rfm-favorite-points-v1'),
      car:localStorage.getItem('rfm-car-point-v1'),
      stagePush:localStorage.getItem('rfm-stage-push-subscriptions-v1'),
      wallet:localStorage.getItem('rfm-wallet-stage-passes-v1'),
      assetCached:Boolean(await assetCache.match('/api/rallyfans/public/migration.svg')),
      periodicCached:Boolean(await periodic.match('/api/rallyfans/race/9901')),
      shellCaches:(await caches.keys()).filter(name=>name.startsWith('rfm-companion-')).sort()
    };
  },seed);
}

test('migrates installed PWA from current main to branch without losing persistent data',async({page,context})=>{
  const reset=await page.request.post('/__migration/reset');
  expect(reset.ok()).toBe(true);

  await page.goto('/');
  await waitForActiveWorker(page);
  await page.reload({waitUntil:'domcontentloaded'});

  const serverBefore=await page.evaluate(()=>fetch('/__migration/state',{method:'POST',cache:'no-store'}).then(r=>r.json()));
  expect(serverBefore.active).toBe('main');

  const seed=await seedPersistentData(page);
  const before=await readPersistentState(page,seed);

  expect(before.indexed.packageName).toBe('Main Migration Rally');
  expect(before.assetCached).toBe(true);
  expect(before.periodicCached).toBe(true);
  expect(before.shellCaches.length).toBeGreaterThan(0);

  await page.evaluate(async()=>{
    const response=await fetch('/__migration/switch',{method:'POST',cache:'no-store'});
    if(!response.ok) throw new Error(`Could not switch migration server: ${response.status}`);
    const reg=await navigator.serviceWorker.getRegistration('/');
    if(!reg) throw new Error('Service worker registration disappeared before upgrade');
    await reg.update();
  });

  await expect.poll(async()=>{
    try{
      return await page.evaluate(()=>fetch('/__migration/state',{method:'POST',cache:'no-store'}).then(r=>r.json()).then(x=>x.active));
    }catch{return null;}
  }).toBe('branch');

  await expect.poll(async()=>{
    try{return await page.locator('.app-footer').textContent();}catch{return '';}
  },{timeout:15_000}).toContain(`v${branchRelease.version}`);

  await waitForActiveWorker(page);
  const after=await readPersistentState(page,seed);

  expect(after.indexed).toEqual(before.indexed);
  expect(after.opfsMapBytes).toBe(before.opfsMapBytes);
  expect(after.opfsTerrainBytes).toBe(before.opfsTerrainBytes);
  expect(after.favorites).toBe(before.favorites);
  expect(after.car).toBe(before.car);
  expect(after.stagePush).toBe(before.stagePush);
  expect(after.wallet).toBe(before.wallet);
  expect(after.assetCached).toBe(true);
  expect(after.periodicCached).toBe(true);
  expect(after.shellCaches.length).toBe(1);

  // controllerchange triggers an automatic reload in the app runtime. Once the
  // branch version and active worker are confirmed, wait for the restored UI
  // instead of racing that automatic navigation with a second reload.
  await expect(page.locator('#packageList')).toContainText('Main Migration Rally');
  await expect(page.locator('#favoritesList')).toContainText('Migration point');
  await expect(page.locator('#carPointCard')).toBeVisible();
  await expect(page.locator('#carCoords')).toContainText('61.710000');

  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#networkBadge')).toHaveText('офлайн');
  await expect(page.locator('#packageList')).toContainText('Main Migration Rally');
  await expect(page.locator('#favoritesList')).toContainText('Migration point');
});
