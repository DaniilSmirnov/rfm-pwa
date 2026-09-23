const CACHE='rfm-companion-v040-rfm-icon';
const ASSET_CACHE='rfm-race-assets-v1';
const SHELL=['/','/index.html','/src/styles.css','/src/app.js','/src/db.js','/src/normalize.js','/src/map.js','/src/rallyfans.js','/src/yandex.js','/src/navigation.js','/src/offline-map.js','/manifest.webmanifest','/icon.svg','/rfm/icon.png','/assets/location.svg','/assets/document-copy.svg','/assets/arrow-right.svg','/assets/telegram.svg'];
const EXTERNAL=['https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.js','https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css','https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js'];

async function precacheFresh(){
  const cache=await caches.open(CACHE);
  await Promise.all(SHELL.map(async url=>{
    const response=await fetch(new Request(url,{cache:'reload'}));
    if(!response.ok) throw new Error(`Precache ${url}: ${response.status}`);
    await cache.put(url,response);
  }));
  await Promise.all(EXTERNAL.map(async url=>{
    try {
      const response=await fetch(url,{cache:'reload'});
      if(response.ok) await cache.put(url,response);
    } catch {}
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

  if(url.origin!==location.origin){
    if(url.hostname==='unpkg.com'){
      event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
        if(response.ok) caches.open(CACHE).then(c=>c.put(event.request,response.clone()));
        return response;
      })));
    }
    return;
  }

  if(url.pathname.startsWith('/api/rallyfans/public/')){
    event.respondWith(caches.open(ASSET_CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request).then(response=>{
      if(response.ok) cache.put(event.request,response.clone());
      return response;
    })));
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
