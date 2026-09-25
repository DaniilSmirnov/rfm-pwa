import { commonHeaders, fetchWithTimeout, json } from './http.js';

export const API_ORIGIN = 'https://api.rallyfansmap.ru';
export const BASEMAP_PM = 'https://data.source.coop/protomaps/openstreetmap/tiles/v3.pmtiles';
export const TERRAIN_TILE_ORIGIN = 'https://tiles.mapterhorn.com';
export const RFM_ICON_URL = 'https://rallyfansmap.ru/assets/icons/apple-touch-icon.png';

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
    upstream = await fetchWithTimeout(target.toString(), {
      method: request.method,
      headers,
      signal:request.signal,
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
    upstream = await fetchWithTimeout(target.toString(), { headers:{ 'accept':'text/html,*/*', 'user-agent':'RallyFans-Companion/0.3.1' }, redirect:'follow',signal:request.signal },12_000);
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
  try { upstream=await fetchWithTimeout(BASEMAP_PM,{method:request.method,headers,redirect:'follow',signal:request.signal},15_000); }
  catch(e){ return json({ok:false,error:'Basemap upstream unavailable',detail:String(e?.message||e)},502); }
  const out=new Headers(commonHeaders({'content-type':upstream.headers.get('content-type')||'application/octet-stream','cache-control':'public, max-age=86400'}));
  for(const h of ['accept-ranges','content-range','content-length','etag','last-modified']){ const v=upstream.headers.get(h); if(v) out.set(h,v); }
  return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:out});
}

async function proxyTerrainTile(request,url){
  if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:commonHeaders({allow:'GET, HEAD'})});
  const match=url.pathname.match(/^\/api\/terrain\/(\d+)\/(\d+)\/(\d+)\.webp$/);
  if(!match) return new Response('Not found',{status:404,headers:commonHeaders()});
  const [z,x,y]=match.slice(1).map(Number);
  if(!Number.isInteger(z)||!Number.isInteger(x)||!Number.isInteger(y)||z<0||z>17||x<0||y<0||x>=2**z||y>=2**z) return new Response('Invalid tile',{status:400,headers:commonHeaders()});
  let upstream;
  try { upstream=await fetchWithTimeout(`${TERRAIN_TILE_ORIGIN}/${z}/${x}/${y}.webp`,{method:request.method,headers:{accept:'image/webp,*/*'},redirect:'follow',signal:request.signal,cf:{cacheEverything:true,cacheTtl:604800}},10_000); }
  catch(e){ return json({ok:false,error:'Terrain upstream unavailable',detail:String(e?.message||e)},502); }
  const headers=new Headers(commonHeaders({
    'content-type':upstream.headers.get('content-type')||'image/webp',
    'cache-control':'public, max-age=604800, s-maxage=604800'
  }));
  const length=upstream.headers.get('content-length'); if(length) headers.set('content-length',length);
  return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,statusText:upstream.statusText,headers});
}

export const RFM_FONTS = new Set([
  'RFDewiExpanded-Black.cd06241e.woff2',
  'RFDewiExpanded-BoldItalic.67413952.ttf',
  'RFDewiExpanded-Bold.ba737abf.ttf',
  'RFDewiExpanded-Semibold.eb002abf.ttf'
]);
async function proxyRfmFont(request,url){
  const name=url.pathname.split('/').pop();
  if(!RFM_FONTS.has(name)) return new Response('Not found',{status:404});
  let upstream;
  try{upstream=await fetchWithTimeout(`https://rallyfansmap.ru/fonts/${name}`,{signal:request.signal,cf:{cacheEverything:true,cacheTtl:604800}},8_000);}
  catch(error){return json({ok:false,error:'Font upstream unavailable',detail:String(error?.message||error)},502);}
  const h=new Headers(commonHeaders({'content-type':upstream.headers.get('content-type')||'font/ttf','cache-control':'public, max-age=604800'}));
  return new Response(upstream.body,{status:upstream.status,headers:h});
}


export { apiTarget, allowedYandexConstructorUrl, extractBalancedObject, importYandexConstructor, proxyBasemap, proxyTerrainTile, proxyRfmFont, proxyRallyFans };
