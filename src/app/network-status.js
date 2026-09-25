import { fetchWithTimeout } from './net.js';

export async function probeConnectivity({url='/api/health',timeoutMs=2500}={}){
  if(!navigator.onLine) return false;
  try{
    await fetchWithTimeout(url,{method:'GET',cache:'no-store'},timeoutMs);
    return true;
  }catch{
    return false;
  }
}

export function createConnectivityMonitor({
  probe=()=>probeConnectivity(),
  onChange=()=>{},
  intervalMs=10_000
}={}){
  let online=Boolean(navigator.onLine);
  let timer=null;
  let stopped=false;
  let checking=false;

  const emit=next=>{
    const normalized=Boolean(next);
    const changed=normalized!==online;
    online=normalized;
    if(changed) onChange(online);
    return changed;
  };

  const check=async()=>{
    if(stopped||checking) return online;
    if(!navigator.onLine){
      emit(false);
      return false;
    }
    checking=true;
    try{
      const reachable=await probe();
      emit(reachable);
      return reachable;
    }finally{
      checking=false;
    }
  };

  const handleOffline=()=>emit(false);
  const handleOnline=()=>{ void check(); };
  const handleFocus=()=>{ void check(); };
  const handleVisibility=()=>{ if(document.visibilityState==='visible') void check(); };

  window.addEventListener('offline',handleOffline);
  window.addEventListener('online',handleOnline);
  window.addEventListener('focus',handleFocus);
  document.addEventListener('visibilitychange',handleVisibility);

  timer=setInterval(()=>{ if(document.visibilityState==='visible') void check(); },intervalMs);
  void check();

  return {
    get online(){ return online; },
    check,
    stop(){
      stopped=true;
      if(timer) clearInterval(timer);
      window.removeEventListener('offline',handleOffline);
      window.removeEventListener('online',handleOnline);
      window.removeEventListener('focus',handleFocus);
      document.removeEventListener('visibilitychange',handleVisibility);
    }
  };
}
