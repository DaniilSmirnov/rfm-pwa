const API_ORIGIN = 'https://api.rallyfansmap.ru';
const BASEMAP_PM = 'https://data.source.coop/protomaps/openstreetmap/tiles/v3.pmtiles';
const RFM_ICON_URL = 'https://rallyfansmap.ru/assets/icons/apple-touch-icon.png';
const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary='';
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function textToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}
async function sha256Base64Url(value) {
  return bytesToBase64Url(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
}
function pushEndpointAllowed(endpoint) {
  try {
    const u=new URL(endpoint);
    if (u.protocol!=='https:') return false;
    const h=u.hostname.toLowerCase();
    return h==='web.push.apple.com'
      || h.endsWith('.push.apple.com')
      || h==='fcm.googleapis.com'
      || h.endsWith('.googleapis.com')
      || h==='updates.push.services.mozilla.com'
      || h.endsWith('.push.services.mozilla.com');
  } catch { return false; }
}
function pushConfigured(env) {
  return Boolean(env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_JWK && env?.VAPID_SUBJECT);
}
async function vapidJwt(endpoint, env) {
  if (!pushConfigured(env)) throw new Error('Push is not configured');
  const target=new URL(endpoint);
  const header=textToBase64Url(JSON.stringify({typ:'JWT',alg:'ES256'}));
  const payload=textToBase64Url(JSON.stringify({
    aud:target.origin,
    exp:Math.floor(Date.now()/1000)+(12*60*60),
    sub:env.VAPID_SUBJECT
  }));
  const input=`${header}.${payload}`;
  const jwk=JSON.parse(env.VAPID_PRIVATE_JWK);
  const key=await crypto.subtle.importKey(
    'jwk',
    jwk,
    {name:'ECDSA',namedCurve:'P-256'},
    false,
    ['sign']
  );
  const signature=await crypto.subtle.sign(
    {name:'ECDSA',hash:'SHA-256'},
    key,
    encoder.encode(input)
  );
  return `${input}.${bytesToBase64Url(signature)}`;
}
async function sendEmptyPush(endpoint, env, ttlSeconds=21600) {
  if (!pushEndpointAllowed(endpoint)) return {ok:false,status:400,error:'Unsupported push endpoint'};
  const token=await vapidJwt(endpoint,env);
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{
      'TTL':String(Math.max(60,Math.min(172800,Number(ttlSeconds)||21600))),
      'Urgency':'normal',
      'Authorization':`vapid t=${token}, k=${env.VAPID_PUBLIC_KEY}`
    }
  });
  return {ok:response.ok,status:response.status};
}
async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
async function subscriptionKey(endpoint) {
  return `sub:${await sha256Base64Url(endpoint)}`;
}
async function subscriptionHash(endpoint) {
  return await sha256Base64Url(endpoint);
}
function reminderPrefix(subHash, raceId='') {
  return `reminder:${subHash}:${raceId ? String(raceId)+':' : ''}`;
}
function validReminder(item) {
  const dueAt=Number(item?.dueAt);
  return Number.isFinite(dueAt)
    && dueAt>Date.now()-5*60*1000
    && dueAt<Date.now()+14*24*60*60*1000
    && String(item?.title||'').length<=120
    && String(item?.body||'').length<=240;
}
async function clearReminderPrefix(store,prefix) {
  let cursor;
  do {
    const page=await store.list({prefix,cursor});
    await Promise.all(page.keys.map(k=>store.delete(k.name)));
    cursor=page.list_complete?undefined:page.cursor;
  } while(cursor);
}
async function runDueReminders(env, now=Date.now()) {
  if (!pushConfigured(env) || !env?.PUSH_SUBSCRIPTIONS) {
    return {ok:false,error:'Push storage/config is missing'};
  }
  let cursor;
  let checked=0,sent=0,failed=0,removed=0;
  do {
    const page=await env.PUSH_SUBSCRIPTIONS.list({prefix:'reminder:',cursor,limit:1000});
    for (const key of page.keys) {
      checked++;
      const job=await env.PUSH_SUBSCRIPTIONS.get(key.name,'json');
      if(!job){ await env.PUSH_SUBSCRIPTIONS.delete(key.name); continue; }
      if(Number(job.dueAt)>now) continue;
      const endpoint=job?.subscription?.endpoint;
      if(!pushEndpointAllowed(endpoint)){
        await env.PUSH_SUBSCRIPTIONS.delete(key.name);
        removed++;
        continue;
      }
      try{
        const hash=await subscriptionHash(endpoint);
        await env.PUSH_SUBSCRIPTIONS.put(
          `pending:${hash}`,
          JSON.stringify({
            title:job.title||'Rally Fans Map',
            body:job.body||'Событие гонки скоро начнётся.',
            url:job.url||'/',
            tag:job.tag||`rfm-reminder-${job.raceId||'race'}`,
            dueAt:job.dueAt
          }),
          {expirationTtl:600}
        );
        const result=await sendEmptyPush(endpoint,env,Math.max(1800,Number(job.ttlSeconds)||21600));
        if(result.ok){
          sent++;
          await env.PUSH_SUBSCRIPTIONS.delete(key.name);
        } else {
          failed++;
          if([404,410].includes(result.status)){
            await env.PUSH_SUBSCRIPTIONS.delete(key.name);
            removed++;
          }
        }
      }catch{
        failed++;
      }
    }
    cursor=page.list_complete?undefined:page.cursor;
  } while(cursor);
  return {ok:true,checked,sent,failed,removed,now};
}
async function handlePushApi(request, env, url) {
  if (url.pathname==='/api/push/config') {
    if (request.method!=='GET') return json({ok:false,error:'Method not allowed'},405);
    return json({
      ok:true,
      enabled:pushConfigured(env),
      publicKey:pushConfigured(env)?env.VAPID_PUBLIC_KEY:null,
      storage:Boolean(env?.PUSH_SUBSCRIPTIONS)
    });
  }

  if (url.pathname==='/api/push/subscribe') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!pushConfigured(env)) return json({ok:false,error:'Push is not configured on Cloudflare Pages'},503);
    const body=await readJson(request);
    const subscription=body?.subscription || body;
    const endpoint=subscription?.endpoint;
    if (!pushEndpointAllowed(endpoint)) return json({ok:false,error:'Unsupported push endpoint'},400);
    let stored=false;
    if (env?.PUSH_SUBSCRIPTIONS) {
      await env.PUSH_SUBSCRIPTIONS.put(
        await subscriptionKey(endpoint),
        JSON.stringify({subscription,createdAt:new Date().toISOString()})
      );
      stored=true;
    }
    return json({ok:true,stored});
  }

  if (url.pathname==='/api/push/unsubscribe') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    const body=await readJson(request);
    const endpoint=body?.endpoint;
    if (!pushEndpointAllowed(endpoint)) return json({ok:false,error:'Unsupported push endpoint'},400);
    if (env?.PUSH_SUBSCRIPTIONS) await env.PUSH_SUBSCRIPTIONS.delete(await subscriptionKey(endpoint));
    return json({ok:true});
  }

  if (url.pathname==='/api/push/test') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!pushConfigured(env)) return json({ok:false,error:'Push is not configured on Cloudflare Pages'},503);
    const body=await readJson(request);
    const endpoint=body?.subscription?.endpoint || body?.endpoint;
    if (!pushEndpointAllowed(endpoint)) return json({ok:false,error:'Unsupported push endpoint'},400);
    const result=await sendEmptyPush(endpoint,env);
    return json({ok:result.ok,status:result.status},result.ok?200:502);
  }

  if (url.pathname==='/api/push/schedule') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!pushConfigured(env) || !env?.PUSH_SUBSCRIPTIONS) return json({ok:false,error:'Push storage/config is missing'},503);
    const body=await readJson(request);
    const subscription=body?.subscription;
    const endpoint=subscription?.endpoint;
    const raceId=String(body?.raceId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64);
    const reminders=Array.isArray(body?.reminders)?body.reminders.filter(validReminder).slice(0,48):[];
    if(!pushEndpointAllowed(endpoint) || !raceId) return json({ok:false,error:'Invalid subscription or raceId'},400);
    const subHash=await subscriptionHash(endpoint);
    await clearReminderPrefix(env.PUSH_SUBSCRIPTIONS,reminderPrefix(subHash,raceId));
    let stored=0;
    for(const item of reminders){
      const eventId=await sha256Base64Url(`${item.dueAt}:${item.title||''}:${item.body||''}`);
      const key=`${reminderPrefix(subHash,raceId)}${String(item.dueAt).padStart(13,'0')}:${eventId.slice(0,16)}`;
      await env.PUSH_SUBSCRIPTIONS.put(key,JSON.stringify({
        subscription,
        raceId,
        dueAt:Number(item.dueAt),
        title:String(item.title||'Rally Fans Map').slice(0,120),
        body:String(item.body||'').slice(0,240),
        url:String(item.url||'/').slice(0,300),
        tag:String(item.tag||`rfm-race-${raceId}`).slice(0,100),
        ttlSeconds:Number(item.ttlSeconds)||21600
      }));
      stored++;
    }
    return json({ok:true,stored});
  }

  if (url.pathname==='/api/push/pending') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!env?.PUSH_SUBSCRIPTIONS) return json({ok:false,error:'Push storage is missing'},503);
    const body=await readJson(request);
    const endpoint=body?.endpoint;
    if(!pushEndpointAllowed(endpoint)) return json({ok:false,error:'Unsupported push endpoint'},400);
    const key=`pending:${await subscriptionHash(endpoint)}`;
    const pending=await env.PUSH_SUBSCRIPTIONS.get(key,'json');
    if(pending) await env.PUSH_SUBSCRIPTIONS.delete(key);
    return json({ok:true,pending:pending||null});
  }

  if (url.pathname==='/api/push/run-due') {
    if (!['POST','GET'].includes(request.method)) return json({ok:false,error:'Method not allowed'},405);
    const auth=request.headers.get('authorization')||'';
    const token=url.searchParams.get('token')||'';
    if (!env.PUSH_ADMIN_TOKEN || (auth!==`Bearer ${env.PUSH_ADMIN_TOKEN}` && token!==env.PUSH_ADMIN_TOKEN)) {
      return json({ok:false,error:'Unauthorized'},401);
    }
    const result=await runDueReminders(env);
    return json(result,result.ok?200:503);
  }

  if (url.pathname==='/api/push/broadcast') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!pushConfigured(env) || !env?.PUSH_SUBSCRIPTIONS) return json({ok:false,error:'Push storage/config is missing'},503);
    const auth=request.headers.get('authorization')||'';
    if (!env.PUSH_ADMIN_TOKEN || auth!==`Bearer ${env.PUSH_ADMIN_TOKEN}`) return json({ok:false,error:'Unauthorized'},401);

    let cursor=undefined;
    let sent=0,failed=0,removed=0;
    do {
      const page=await env.PUSH_SUBSCRIPTIONS.list({prefix:'sub:',cursor});
      for (const key of page.keys) {
        const record=await env.PUSH_SUBSCRIPTIONS.get(key.name,'json');
        const endpoint=record?.subscription?.endpoint;
        if (!pushEndpointAllowed(endpoint)) {
          await env.PUSH_SUBSCRIPTIONS.delete(key.name);
          removed++;
          continue;
        }
        try {
          const result=await sendEmptyPush(endpoint,env);
          if (result.ok) sent++;
          else {
            failed++;
            if ([404,410].includes(result.status)) {
              await env.PUSH_SUBSCRIPTIONS.delete(key.name);
              removed++;
            }
          }
        } catch {
          failed++;
        }
      }
      cursor=page.list_complete?undefined:page.cursor;
    } while(cursor);

    return json({ok:true,sent,failed,removed});
  }

  return json({ok:false,error:'Unsupported push API path'},404);
}


function apiTarget(pathname) {
  // Canonical routes used by the app, plus short aliases for easier diagnostics.
  if (pathname === '/api/rallyfans/race' || pathname === '/api/race') return new URL('/race', API_ORIGIN);

  let race = pathname.match(/^\/api\/rallyfans\/race\/(\d+)$/);
  if (!race) race = pathname.match(/^\/api\/race\/(\d+)$/);
  if (race) return new URL(`/race/${race[1]}`, API_ORIGIN);

  let asset = pathname.match(/^\/api\/rallyfans\/public\/([^/]+)$/);
  if (!asset) asset = pathname.match(/^\/api\/public\/([^/]+)$/);
  if (asset) {
    let filename;
    try { filename = decodeURIComponent(asset[1]); } catch { return null; }
    if (!filename || filename.includes('/') || filename.includes('\\') || filename === '.' || filename === '..') return null;
    return new URL(`/public/${encodeURIComponent(filename)}`, API_ORIGIN);
  }
  return null;
}

function commonHeaders(extra = {}) {
  return {
    'x-rfm-worker': 'rallyfans-companion-v0.5.0',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: commonHeaders({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }),
  });
}

function upstreamHeaders(response, isAsset) {
  const headers = new Headers(commonHeaders());
  const contentType = response.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('cache-control', isAsset ? 'public, max-age=86400, s-maxage=86400' : 'no-store');
  return headers;
}

async function proxyRallyFans(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: commonHeaders({ allow: 'GET, HEAD' }) });
  }

  const target = apiTarget(url.pathname);
  if (!target) return json({ ok: false, error: 'Unsupported RallyFans API path', path: url.pathname }, 404);

  const isAsset = target.pathname.startsWith('/public/');
  const headers = new Headers();
  headers.set('accept', request.headers.get('accept') || '*/*');
  // This is not authorization; it simply makes the upstream request resemble the public site.
  headers.set('user-agent', 'RallyFans-Companion/0.3');

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: request.method,
      headers,
      redirect: 'follow',
      cf: isAsset ? { cacheEverything: true, cacheTtl: 86400 } : undefined,
    });
  } catch (error) {
    return json({ ok: false, error: 'RallyFans upstream unavailable', detail: String(error?.message || error) }, 502);
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstreamHeaders(upstream, isAsset),
  });
}

function allowedYandexConstructorUrl(raw) {
  try {
    const u = new URL(raw);
    if (!['yandex.ru','www.yandex.ru'].includes(u.hostname)) return null;
    if (!u.pathname.startsWith('/map-widget/v1/')) return null;
    const um = u.searchParams.get('um') || '';
    if (!um.startsWith('constructor:')) return null;
    return u;
  } catch { return null; }
}

function extractBalancedObject(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  let start = text.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

async function importYandexConstructor(request, url) {
  if (request.method !== 'GET') return json({ok:false,error:'Method not allowed'},405);
  const target = allowedYandexConstructorUrl(url.searchParams.get('url') || '');
  if (!target) return json({ok:false,error:'Unsupported Yandex Constructor URL'},400);
  let upstream;
  try {
    upstream = await fetch(target.toString(), { headers:{ 'accept':'text/html,*/*', 'user-agent':'RallyFans-Companion/0.3.1' }, redirect:'follow' });
  } catch (e) { return json({ok:false,error:'Yandex Constructor unavailable',detail:String(e?.message||e)},502); }
  if (!upstream.ok) return json({ok:false,error:`Yandex HTTP ${upstream.status}`},502);
  const html = await upstream.text();
  if (html.length > 4_000_000) return json({ok:false,error:'Yandex response is too large'},502);
  const raw = extractBalancedObject(html, '"userMap":');
  if (!raw) return json({ok:false,error:'userMap data not found in Yandex widget'},422);
  let userMap;
  try { userMap = JSON.parse(raw); } catch { return json({ok:false,error:'Could not parse Yandex userMap'},422); }
  const features = Array.isArray(userMap?.features) ? userMap.features : [];
  return json({ok:true,constructorUrl:target.toString(),sourceFeatureCount:features.length,features});
}

async function proxyBasemap(request) {
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:commonHeaders({allow:'GET, HEAD'})});
  const headers=new Headers();
  const range=request.headers.get('range'); if(range) headers.set('range',range);
  headers.set('accept','application/octet-stream,*/*');
  let upstream;
  try { upstream=await fetch(BASEMAP_PM,{method:request.method,headers,redirect:'follow'}); }
  catch(e){ return json({ok:false,error:'Basemap upstream unavailable',detail:String(e?.message||e)},502); }
  const out=new Headers(commonHeaders({'content-type':upstream.headers.get('content-type')||'application/octet-stream','cache-control':'public, max-age=86400'}));
  for(const h of ['accept-ranges','content-range','content-length','etag','last-modified']){ const v=upstream.headers.get(h); if(v) out.set(h,v); }
  return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:out});
}

const RFM_FONTS = new Set([
  'RFDewiExpanded-Black.cd06241e.woff2',
  'RFDewiExpanded-BoldItalic.67413952.ttf',
  'RFDewiExpanded-Bold.ba737abf.ttf',
  'RFDewiExpanded-Semibold.eb002abf.ttf'
]);
async function proxyRfmFont(request,url){
  const name=url.pathname.split('/').pop();
  if(!RFM_FONTS.has(name)) return new Response('Not found',{status:404});
  const upstream=await fetch(`https://rallyfansmap.ru/fonts/${name}`,{cf:{cacheEverything:true,cacheTtl:604800}});
  const h=new Headers(commonHeaders({'content-type':upstream.headers.get('content-type')||'font/ttf','cache-control':'public, max-age=604800'}));
  return new Response(upstream.body,{status:upstream.status,headers:h});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' || url.pathname === '/api/rallyfans/health') {
      return json({
        ok: true,
        service: 'rallyfans-companion',
        version: '0.5.0',
        upstream: API_ORIGIN,
        basemap: BASEMAP_PM,
        hint: 'If this endpoint works, the Cloudflare Pages Worker is active.'
      });
    }

    if (url.pathname.startsWith('/api/push/')) return handlePushApi(request,env,url);

    if (url.pathname === '/api/yandex/constructor') return importYandexConstructor(request, url);
    if (url.pathname === '/rfm/icon.png') {
      const upstream = await fetch(RFM_ICON_URL, { cf:{ cacheEverything:true, cacheTtl:604800 } });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: commonHeaders({
          'content-type': 'image/png',
          'cache-control': 'public, max-age=604800'
        })
      });
    }

    if (url.pathname === '/api/basemap.pmtiles') return proxyBasemap(request);
    if (url.pathname.startsWith('/rfm/fonts/')) return proxyRfmFont(request,url);

    if (url.pathname.startsWith('/api/rallyfans/') || url.pathname === '/api/race' || url.pathname.startsWith('/api/race/') || url.pathname.startsWith('/api/public/')) {
      return proxyRallyFans(request, url);
    }

    if (!env?.ASSETS) {
      return json({ ok: false, error: 'ASSETS binding missing. Deploy this as a Cloudflare Pages project, not as a plain Worker.' }, 500);
    }
    const asset = await env.ASSETS.fetch(request);
    if (['/sw.js','/index.html','/manifest.webmanifest','/'].includes(url.pathname)) {
      const headers = new Headers(asset.headers);
      headers.set('cache-control','no-cache, no-store, must-revalidate');
      headers.set('pragma','no-cache');
      headers.set('expires','0');
      return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
    }
    return asset;
  },
};
