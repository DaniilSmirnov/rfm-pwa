const ENDPOINT='/api/telemetry/error';
const recent=new Map();
const DEDUPE_MS=30_000;

function clean(value,max){
  return String(value ?? '').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,max);
}

function currentPath(){
  try{return location.pathname||'/';}catch{return '/';}
}

function errorPayload(error,kind='error'){
  const value=error instanceof Error?error:null;
  return {
    kind:clean(kind,80),
    name:clean(value?.name||error?.name||'Error',120),
    message:clean(value?.message||error?.message||error||'Unknown error',600),
    stack:clean(value?.stack||error?.stack||'',6000),
    path:clean(currentPath(),300)
  };
}

function fingerprint(payload){
  return [payload.kind,payload.name,payload.message,payload.path].join('|');
}

export function reportClientError(error,kind='error'){
  const payload=errorPayload(error,kind);
  const key=fingerprint(payload);
  const now=Date.now();
  const previous=recent.get(key)||0;
  if(now-previous<DEDUPE_MS) return false;
  recent.set(key,now);

  const body=JSON.stringify(payload);
  try{
    if(navigator.sendBeacon){
      const sent=navigator.sendBeacon(ENDPOINT,new Blob([body],{type:'application/json'}));
      if(sent) return true;
    }
  }catch{}
  try{
    fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
    return true;
  }catch{
    return false;
  }
}

export function setupErrorTelemetry(){
  window.addEventListener('error',event=>{
    reportClientError(event.error || {name:'Error',message:event.message,stack:''},'window-error');
  });
  window.addEventListener('unhandledrejection',event=>{
    const reason=event.reason instanceof Error?event.reason:new Error(String(event.reason??'Unhandled rejection'));
    reportClientError(reason,'unhandled-rejection');
  });
}
