const VERSION='v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname==='/__sw-version'){
    event.respondWith(new Response(VERSION,{headers:{'content-type':'text/plain'}}));
  }
});
