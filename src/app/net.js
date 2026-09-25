export class NetworkTimeoutError extends Error{
  constructor(url,timeoutMs){
    super(`Сетевой запрос превысил таймаут ${timeoutMs} мс: ${url}`);
    this.name='NetworkTimeoutError';
    this.url=String(url);
    this.timeoutMs=timeoutMs;
  }
}

export async function fetchWithTimeout(input,options={},timeoutMs=8000){
  const controller=new AbortController();
  const external=options.signal;
  let timedOut=false;
  const abortFromExternal=()=>controller.abort(external?.reason);
  if(external){
    if(external.aborted) abortFromExternal();
    else external.addEventListener('abort',abortFromExternal,{once:true});
  }
  const timer=setTimeout(()=>{
    timedOut=true;
    controller.abort();
  },timeoutMs);
  try{
    return await fetch(input,{...options,signal:controller.signal});
  }catch(error){
    if(timedOut) throw new NetworkTimeoutError(input,timeoutMs);
    throw error;
  }finally{
    clearTimeout(timer);
    external?.removeEventListener?.('abort',abortFromExternal);
  }
}
