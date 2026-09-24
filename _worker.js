import { API_ORIGIN, BASEMAP_PM, json, commonHeaders } from './worker/shared.js';
import { handlePushApi } from './worker/push.js';
import { handleWalletApi } from './worker/wallet.js';
import { proxyRallyFans, importYandexConstructor, proxyBasemap, proxyRfmFont, proxyRfmIcon } from './worker/proxy.js';

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/health' || url.pathname==='/api/rallyfans/health'){
      return json({ok:true,service:'rallyfans-companion',version:'0.5.5',upstream:API_ORIGIN,basemap:BASEMAP_PM,hint:'If this endpoint works, the Cloudflare Pages Worker is active.'});
    }
    if(url.pathname.startsWith('/api/push/')) return handlePushApi(request,env,url,ctx);
    if(url.pathname.startsWith('/api/wallet/')) return handleWalletApi(request,env,url);
    if(url.pathname==='/api/yandex/constructor') return importYandexConstructor(request,url);
    if(url.pathname==='/rfm/icon.png') return proxyRfmIcon();
    if(url.pathname==='/api/basemap.pmtiles') return proxyBasemap(request);
    if(url.pathname.startsWith('/rfm/fonts/')) return proxyRfmFont(request,url);
    if(url.pathname.startsWith('/api/rallyfans/') || url.pathname==='/api/race' || url.pathname.startsWith('/api/race/') || url.pathname.startsWith('/api/public/')) return proxyRallyFans(request,url);
    if(!env?.ASSETS) return json({ok:false,error:'ASSETS binding missing. Deploy this as a Cloudflare Pages project, not as a plain Worker.'},500);
    const asset=await env.ASSETS.fetch(request);
    if(['/sw.js','/index.html','/manifest.webmanifest','/'].includes(url.pathname)){
      const headers=new Headers(asset.headers);
      headers.set('cache-control','no-cache, no-store, must-revalidate');
      headers.set('pragma','no-cache');
      headers.set('expires','0');
      return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
    }
    return asset;
  }
};
