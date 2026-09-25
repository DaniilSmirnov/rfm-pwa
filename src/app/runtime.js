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

export function requestRallyPackBackgroundRefresh(reg){
  const worker=reg?.active || navigator.serviceWorker?.controller;
  if(!worker?.postMessage) return false;
  worker.postMessage({type:'REFRESH_RALLY_PACKS'});
  return true;
}

export function requestCrewResultsBackgroundRefresh(reg){
  const worker=reg?.active||navigator.serviceWorker?.controller;
  if(!worker?.postMessage)return false;
  worker.postMessage({type:'REFRESH_CREW_RESULTS'});
  return true;
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
    let crewResultsRegistered=false;
    try{
      await reg.periodicSync.register('rfm-refresh-crew-results',{minInterval:15*60*1000});
      crewResultsRegistered=true;
    }catch(error){console.warn('Periodic crew results sync registration failed',error);}
    return {supported:true,registered:true,crewResultsRegistered};
  }catch(e){
    console.warn('Periodic Background Sync registration failed',e);
    return {supported:true,registered:false};
  }
}

export async function setupServiceWorkerUpdates({onDiagnostic}={}){
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
    onDiagnostic?.('sw-register-start');
    const reg=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
    onDiagnostic?.('sw-register-ready');
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

    const check=async()=>{
      const started=performance.now();
      onDiagnostic?.('sw-update-check-start');
      try{
        await reg.update();
        onDiagnostic?.('sw-update-check-done',{durationMs:Math.round(performance.now()-started)});
      }catch(error){
        onDiagnostic?.('sw-update-check-failed',{durationMs:Math.round(performance.now()-started),message:String(error?.message||error)});
      }
    };
    // Update checks are maintenance work and must never block local-first startup.
    void check();
    setInterval(check,5*60*1000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') check();});
    window.addEventListener('online',check);
    return reg;
  }catch(err){
    console.error('Service worker registration/update failed',err);
    return null;
  }
}
