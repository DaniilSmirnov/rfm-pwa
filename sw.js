const CACHE='rfm-companion-v__APP_VERSION_CACHE__-__APP_CODENAME_SLUG__';
const ASSET_CACHE='rfm-race-assets-v1';
const PERIODIC_CACHE='rfm-periodic-data-v1';
const SHELL=/*__BUILD_ASSETS__*/[];
async function precacheFresh(){
  const cache=await caches.open(CACHE);
  await Promise.all(SHELL.map(async url=>{
    const response=await fetch(new Request(url,{cache:'reload'}));
    if(!response.ok) throw new Error(`Precache ${url}: ${response.status}`);
    await cache.put(url,response);
  }));

  // Vite filenames are content-hashed. If the same release version is rebuilt,
  // remove only obsolete generated chunks while preserving runtime-cached files.
  const expected=new Set(SHELL);
  const cached=await cache.keys();
  await Promise.all(cached.filter(request=>{
    const url=new URL(request.url);
    return url.origin===self.location.origin
      && url.pathname.startsWith('/assets/')
      && !expected.has(url.pathname);
  }).map(request=>cache.delete(request)));
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
  if(event.data?.type==='REFRESH_RALLY_PACKS') event.waitUntil(refreshPeriodicRaceData());
});

async function fetchWithTimeout(request,timeoutMs=1200){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetch(new Request(request,{cache:'no-store',signal:controller.signal}));
  }finally{
    clearTimeout(timer);
  }
}

async function refreshNavigation(request){
  const cache=await caches.open(CACHE);
  const response=await fetchWithTimeout(request);
  if(response.ok) await cache.put(request,response.clone());
  return response;
}

async function cachedNavigation(request,fallback='/index.html'){
  const cache=await caches.open(CACHE);
  return (await cache.match(request))
    || (fallback ? await cache.match(fallback) : null);
}

self.addEventListener('fetch', event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(url.origin!==location.origin) return;

  if(url.pathname.startsWith('/api/rallyfans/public/')){
    event.respondWith(caches.open(ASSET_CACHE).then(async cache=>(await cache.match(event.request))||fetchWithTimeout(event.request,12000).then(response=>{
      if(response.ok) cache.put(event.request,response.clone());
      return response;
    })));
    return;
  }
  if(url.pathname==='/api/rallyfans/race' || url.pathname.startsWith('/api/rallyfans/race/')){
    event.respondWith((async()=>{
      const cache=await caches.open(PERIODIC_CACHE);
      try{
        const response=await fetchWithTimeout(event.request,8000);
        if(response.ok) await cache.put(event.request,response.clone());
        return response;
      }catch{
        return (await cache.match(event.request)) || Response.error();
      }
    })());
    return;
  }
  if(url.pathname.startsWith('/api/')) return;

  // Navigation is local-first: an installed PWA must open immediately even when
  // Android reports a network that is connected but cannot actually reach the server.
  if(event.request.mode==='navigate' || url.pathname==='/' || url.pathname==='/index.html'){
    const refresh=refreshNavigation(event.request).catch(()=>null);
    event.waitUntil(refresh.then(()=>undefined));
    event.respondWith((async()=>{
      const cached=await cachedNavigation(event.request);
      if(cached) return cached;
      return (await refresh) || Response.error();
    })());
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
          const response=await fetchWithTimeout(new Request('/api/push/pending',{
            method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({endpoint:subscription.endpoint})
          }),5000);
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

function raceAssetNames(race){
  const names=new Set();
  const add=value=>{if(typeof value==='string'&&value.trim())names.add(value.trim());};
  ['image','overlap_schedule','safety_leaflet','mapsimg','list_crews','list_crews2','list_crews3','list_crews4','list_crews5','results_race','results_race2','results_race3','results_race4','results_race5'].forEach(k=>add(race?.[k]));
  const list=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
  list(race?.lists).forEach(x=>add(x?.image));
  list(race?.results).forEach(x=>add(x?.image));
  list(race?.coordinates).forEach(x=>add(x?.image));
  return [...names];
}

async function prefetchRaceAssets(race){
  const cache=await caches.open(ASSET_CACHE);
  await Promise.all(raceAssetNames(race).map(async name=>{
    const url=`/api/rallyfans/public/${encodeURIComponent(name)}`;
    if(await cache.match(url)) return;
    try{
      const response=await fetchWithTimeout(new Request(url,{cache:'no-store'}),12000);
      if(response.ok) await cache.put(url,response);
    }catch{}
  }));
}

async function refreshPeriodicRaceData(){
  const cache=await caches.open(PERIODIC_CACHE);
  try{
    const catalog=await fetchWithTimeout(new Request('/api/rallyfans/race',{cache:'no-store'}),8000);
    if(catalog.ok) await cache.put('/api/rallyfans/race',catalog);
  }catch{}
  const ids=await savedRaceIds();
  await Promise.all([...new Set(ids)].map(async id=>{
    const url=`/api/rallyfans/race/${encodeURIComponent(id)}`;
    try{
      const response=await fetchWithTimeout(new Request(url,{cache:'no-store'}),8000);
      if(!response.ok) return;
      await cache.put(url,response.clone());
      const race=await response.json();
      await prefetchRaceAssets(race);
    }catch{}
  }));
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows) client.postMessage({type:'RFM_PERIODIC_UPDATE'});
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
