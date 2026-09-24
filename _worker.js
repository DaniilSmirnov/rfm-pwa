import { commonHeaders, json } from './src/worker/http.js';
import { handlePushApi } from './src/worker/push.js';
import { handleWalletApi } from './src/worker/wallet.js';
import {
  API_ORIGIN,
  BASEMAP_PM,
  RFM_ICON_URL,
  importYandexConstructor,
  proxyBasemap,
  proxyRfmFont,
  proxyRallyFans
} from './src/worker/proxies.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' || url.pathname === '/api/rallyfans/health') {
      return json({
        ok: true,
        service: 'rallyfans-companion',
        version: '__APP_VERSION__',
        upstream: API_ORIGIN,
        basemap: BASEMAP_PM,
        hint: 'If this endpoint works, the Cloudflare Pages Worker is active.'
      });
    }

    if (url.pathname.startsWith('/api/push/')) return handlePushApi(request,env,url,ctx);
    if (url.pathname.startsWith('/api/wallet/')) return handleWalletApi(request,env,url);

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
