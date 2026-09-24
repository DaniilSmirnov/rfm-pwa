import { json, readJson } from './http.js';

const MAX_MESSAGE=600;
const MAX_STACK=6000;
const DEFAULT_SAMPLE_RATE=0.2;

function clampRate(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return DEFAULT_SAMPLE_RATE;
  return Math.max(0,Math.min(1,n));
}

function cleanText(value,max){
  return String(value ?? '').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,max);
}

export function telemetrySampleRate(env){
  return clampRate(env?.ERROR_TRACE_SAMPLE_RATE);
}

export function shouldSampleError(env,random=Math.random){
  return random()<telemetrySampleRate(env);
}

export function writeErrorTrace(env,event,{random=Math.random}={}){
  if(!env?.ERROR_TRACES?.writeDataPoint || !shouldSampleError(env,random)) return false;
  const kind=cleanText(event?.kind||'error',80);
  const name=cleanText(event?.name||'Error',120);
  const message=cleanText(event?.message||'',MAX_MESSAGE);
  const stack=cleanText(event?.stack||'',MAX_STACK);
  const path=cleanText(event?.path||'/',300);
  const source=cleanText(event?.source||'client',40);
  env.ERROR_TRACES.writeDataPoint({
    indexes:[`${source}:${kind}`.slice(0,96)],
    blobs:[source,kind,name,message,stack,path],
    doubles:[1,telemetrySampleRate(env)]
  });
  return true;
}

export async function handleTelemetryApi(request,env){
  if(request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
  const body=await readJson(request);
  if(!body || typeof body!=='object') return json({ok:false,error:'Invalid JSON'},400);
  writeErrorTrace(env,{
    source:'client',
    kind:body.kind,
    name:body.name,
    message:body.message,
    stack:body.stack,
    path:body.path
  });
  return json({ok:true},202);
}

export function recordWorkerException(env,error,path='/'){
  return writeErrorTrace(env,{
    source:'worker',
    kind:'uncaught',
    name:error?.name||'Error',
    message:error?.message||String(error),
    stack:error?.stack||'',
    path
  });
}
