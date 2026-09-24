const CACHE='rfm-companion-v__APP_VERSION_CACHE__-__APP_CODENAME_SLUG__';
const ASSET_CACHE='rfm-race-assets-v1';
const PERIODIC_CACHE='rfm-periodic-data-v1';
const SHELL=['/','/index.html','/src/styles.css','/src/app.js','/src/db.js','/src/normalize.js','/src/map.js','/src/rallyfans.js','/src/yandex.js','/src/navigation.js','/src/offline-map.js','/src/terrain-offline.js','/src/app/catalog-dates.js','/src/app/export.js','/src/app/geo.js','/src/app/local-points.js','/src/app/preferences.js','/src/app/push-client.js','/src/app/pwa.js','/src/app/runtime.js','/src/app/sanitize.js','/src/app/schedule.js','/src/app/wallet-client.js','/src/app/race-media.js','/src/app/point-list.js','/src/app/schedule-ui.js','/src/app/rally-pack.js','/src/app/rally-pack-ui.js','/src/app/terrain-controls.js',
  '/src/app/elevation.js',
  '/src/app/elevation-ui.js','/src/map/style.js','/src/map/terrain.js','/src/map/terrain-control.js','/src/map/viewport-policy.js','/manifest.webmanifest','/icon.svg','/assets/location.svg','/assets/document-copy.svg','/assets/arrow-right.svg','/assets/telegram.svg','/assets/wallet.svg','/vendor/maplibre-gl/maplibre-gl.mjs','/vendor/maplibre-gl/maplibre-gl-worker.mjs','/vendor/maplibre-gl/maplibre-gl-shared.mjs','/vendor/maplibre-gl/maplibre-gl.css','/vendor/pmtiles/pmtiles.js'];
async function precacheFresh(){
  const cache=await caches.open(CACHE);
  await Promise.all(SHELL.map(async url=>{
    const response=await fetch(new Request(url,{cache:'reload'}));
    if(!response.ok) throw new Error(`Precache ${url}: ${response.status}`);
    await cache.put(url,response);
  }));
}

self.addEventListener('install', event=>{
  event.waitUntil(precacheFresh().then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('rfm-companion-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request,fallback='/index.html'){
  const cache=await caches.open(CACHE);
  try {
    const response=await fetch(new Request(request,{cache:'no-store'}));
    if(response.ok) await cache.put(request,response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallback ? await cache.match(fallback) : Response.error());
  }
}

self.addEventListener('fetch', event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(url.origin!==location.origin) return;

  if(url.pathname.startsWith('/api/rallyfans/public/')){
    event.respondWith(caches.open(ASSET_CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request).then(response=>{
      if(response.ok) cache.put(event.request,response.clone());
      return response;
    })));
    return;
  }
  if(url.pathname==='/api/rallyfans/race' || url.pathname.startsWith('/api/rallyfans/race/')){
    event.respondWith((async()=>{
      const cache=await caches.open(PERIODIC_CACHE);
      try{
        const response=await fetch(new Request(event.request,{cache:'no-store'}));
        if(response.ok) await cache.put(event.request,response.clone());
        return response;
      }catch{
        return (await cache.match(event.request)) || Response.error();
      }
    })());
    return;
  }
  if(url.pathname.startsWith('/api/')) return;

  // HTML navigations must prefer the network so an old cached app shell cannot pin an old release.
  if(event.request.mode==='navigate' || url.pathname==='/' || url.pathname==='/index.html'){
    event.respondWith(networkFirst(event.request));
    return;
  }

  // sw.js is fetched by the browser update algorithm, but never serve a cached copy if requested manually.
  if(url.pathname==='/sw.js'){
    event.respondWith(fetch(new Request(event.request,{cache:'no-store'})));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok) caches.open(CACHE).then(c=>c.put(event.request,response.clone()));
    return response;
  }).catch(()=>caches.match('/index.html'))));
});


self.addEventListener('push', event => {
  event.waitUntil((async()=>{
    let payload={};
    try { payload=event.data?.json?.() || {}; } catch {}

    if(!payload.title){
      try{
        const subscription=await self.registration.pushManager.getSubscription();
        if(subscription?.endpoint){
          const response=await fetch('/api/push/pending',{
            method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({endpoint:subscription.endpoint})
          });
          const data=await response.json();
          if(response.ok && data?.pending) payload=data.pending;
        }
      }catch{}
    }

    await self.registration.showNotification(payload.title || 'Rally Fans Map', {
      body: payload.body || 'Есть обновление по RallyFans. Открой приложение, чтобы проверить данные.',
      icon: '/icon.svg',
      tag: payload.tag || 'rfm-update',
      renotify: true,
      data: { url: payload.url || '/' }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || '/';
  event.waitUntil((async()=>{
    const clientsList = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of clientsList) {
      if ('navigate' in client) {
        try { await client.navigate(target); } catch {}
      }
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  })());
});


async function savedRaceIds(){
  return new Promise(resolve=>{
    try{
      const req=indexedDB.open('rallyfans-offline',2);
      req.onerror=()=>resolve([]);
      req.onsuccess=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('packages')){ resolve([]); return; }
        const tx=db.transaction('packages','readonly');
        const all=tx.objectStore('packages').getAll();
        all.onerror=()=>resolve([]);
        all.onsuccess=()=>resolve((all.result||[]).map(p=>p?.raceId).filter(v=>v!=null));
      };
    }catch{ resolve([]); }
  });
}

async function refreshPeriodicRaceData(){
  const cache=await caches.open(PERIODIC_CACHE);
  const urls=['/api/rallyfans/race'];
  const ids=await savedRaceIds();
  for(const id of [...new Set(ids)]) urls.push(`/api/rallyfans/race/${encodeURIComponent(id)}`);
  await Promise.all(urls.map(async url=>{
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(response.ok) await cache.put(url,response);
    }catch{}
  }));
}

self.addEventListener('periodicsync',event=>{
  if(event.tag==='rfm-refresh-races') event.waitUntil(refreshPeriodicRaceData());
});

self.addEventListener('backgroundfetchsuccess',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(ASSET_CACHE);
    const records=await event.registration.matchAll();
    await Promise.all(records.map(async record=>{
      const response=await record.responseReady;
      if(response?.ok) await cache.put(record.request,response);
    }));
    try{ await event.updateUI({title:'Rally Fans Map · офлайн-материалы готовы'}); }catch{}
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows) client.postMessage({type:'RFM_BACKGROUND_FETCH',status:'success',id:event.registration.id});
  })());
});

self.addEventListener('backgroundfetchfail',event=>{
  event.waitUntil((async()=>{
    try{ await event.updateUI({title:'Rally Fans Map · не удалось скачать материалы'}); }catch{}
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows) client.postMessage({type:'RFM_BACKGROUND_FETCH',status:'failure',id:event.registration.id});
  })());
});

self.addEventListener('backgroundfetchclick',event=>{
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(windows[0]) return windows[0].focus();
    return self.clients.openWindow ? self.clients.openWindow('/') : undefined;
  })());
});
