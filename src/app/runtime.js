const $=id=>document.getElementById(id);

export async function ensurePersistentStorage(){
  if(!navigator.storage) return {supported:false,persisted:false};
  try{
    const before=await navigator.storage.persisted?.();
    const persisted=before || (navigator.storage.persist ? await navigator.storage.persist() : false);
    return {supported:true,persisted:Boolean(persisted)};
  }catch(e){
    console.warn('Persistent Storage request failed',e);
    return {supported:true,persisted:false};
  }
}

export async function setupPeriodicBackgroundSync(reg){
  if(!reg?.periodicSync?.register) return {supported:false};
  try{
    let granted=true;
    if(navigator.permissions?.query){
      try{
        const permission=await navigator.permissions.query({name:'periodic-background-sync'});
        granted=permission.state==='granted';
      }catch{}
    }
    if(!granted) return {supported:true,registered:false};
    await reg.periodicSync.register('rfm-refresh-races',{minInterval:12*60*60*1000});
    return {supported:true,registered:true};
  }catch(e){
    console.warn('Periodic Background Sync registration failed',e);
    return {supported:true,registered:false};
  }
}

export async function setupServiceWorkerUpdates(){
  if(!('serviceWorker' in navigator)) return null;
  const banner=$('updateBanner');
  const updateText=$('updateText');
  let reloading=false;
  const showUpdate=(text='Обновляю приложение…')=>{
    if(updateText) updateText.textContent=text;
    if(banner) banner.hidden=false;
  };

  navigator.serviceWorker.addEventListener('message',event=>{
    const data=event.data;
    if(data?.type==='RFM_BACKGROUND_FETCH'){
      window.dispatchEvent(new CustomEvent('rfm:background-fetch',{detail:data}));
    }
    if(data?.type==='RFM_PERIODIC_UPDATE'){
      window.dispatchEvent(new CustomEvent('rfm:periodic-update',{detail:data}));
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading) return;
    reloading=true;
    showUpdate('Новая версия установлена. Перезапускаю…');
    setTimeout(()=>location.reload(),250);
  });

  try{
    const reg=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
    const activateWaiting=()=>{
      if(reg.waiting){
        showUpdate();
        reg.waiting.postMessage({type:'SKIP_WAITING'});
      }
    };
    activateWaiting();
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing;
      if(!worker) return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed' && navigator.serviceWorker.controller){
          showUpdate();
          worker.postMessage({type:'SKIP_WAITING'});
        }
      });
    });

    const check=()=>reg.update().catch(()=>{});
    await check();
    setInterval(check,5*60*1000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') check();});
    window.addEventListener('online',check);
    return reg;
  }catch(err){
    console.error('Service worker registration/update failed',err);
    return null;
  }
}
