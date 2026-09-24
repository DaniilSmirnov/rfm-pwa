import { geometryBounds } from './normalize.js';
import { saveMapTile, getMapTile, deleteMapTiles } from './db.js';

const SOURCE_URL='/api/basemap.pmtiles';
const MIN_ZOOM=6;
const DESIRED_MAX_ZOOM=14;
const MAX_TILES=2200;
let protocolRegistered=false;
let diagnosticsListener=null;
const stats={hits:0,misses:0,errors:0,last:null};

export function setOfflineMapDiagnosticsListener(fn){ diagnosticsListener=typeof fn==='function'?fn:null; }
function emit(type,detail={}){
  if(type==='hit') stats.hits++;
  if(type==='miss') stats.misses++;
  if(type==='error') stats.errors++;
  stats.last={type,...detail,at:Date.now()};
  diagnosticsListener?.({...stats});
}
export function resetOfflineMapDiagnostics(){ stats.hits=0;stats.misses=0;stats.errors=0;stats.last=null;diagnosticsListener?.({...stats}); }

function clampLat(lat){ return Math.max(-85.05112878,Math.min(85.05112878,lat)); }
function lon2x(lon,z){ return Math.floor((lon+180)/360*(2**z)); }
function lat2y(lat,z){ const r=clampLat(lat)*Math.PI/180; return Math.floor((1-Math.asinh(Math.tan(r))/Math.PI)/2*(2**z)); }
function bufferedBounds(fc){
  const b=geometryBounds(fc); if(!b) return null;
  const dx=Math.max(b.maxLon-b.minLon,.02), dy=Math.max(b.maxLat-b.minLat,.02);
  const padLon=Math.max(.05,dx*.22), padLat=Math.max(.04,dy*.22);
  return {minLon:b.minLon-padLon,maxLon:b.maxLon+padLon,minLat:b.minLat-padLat,maxLat:b.maxLat+padLat};
}
function tileRange(b,z){
  const n=2**z;
  const x0=Math.max(0,lon2x(b.minLon,z)), x1=Math.min(n-1,lon2x(b.maxLon,z));
  const y0=Math.max(0,lat2y(b.maxLat,z)), y1=Math.min(n-1,lat2y(b.minLat,z));
  return {x0,x1,y0,y1,count:Math.max(0,x1-x0+1)*Math.max(0,y1-y0+1)};
}
function tilesAtZoom(b,z){
  const {x0,x1,y0,y1}=tileRange(b,z);
  const out=[]; for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) out.push({z,x,y}); return out;
}
export function buildDownloadPlan(fc){
  const bounds=bufferedBounds(fc); if(!bounds) throw new Error('У гонки нет геометрии для определения района карты');
  for(let maxZoom=DESIRED_MAX_ZOOM;maxZoom>=MIN_ZOOM;maxZoom--){
    let total=0;
    for(let z=MIN_ZOOM;z<=maxZoom;z++){
      total+=tileRange(bounds,z).count;
      if(total>MAX_TILES) break;
    }
    if(total>MAX_TILES) continue;

    const tiles=[];
    for(let z=MIN_ZOOM;z<=maxZoom;z++) tiles.push(...tilesAtZoom(bounds,z));
    return {bounds,minZoom:MIN_ZOOM,maxZoom,tiles};
  }
  throw new Error(`Район карты слишком большой для офлайн-загрузки (лимит ${MAX_TILES} тайлов)`);
}
function normalizeTileData(data){
  if(data instanceof ArrayBuffer) return data;
  if(ArrayBuffer.isView(data)) return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  return data;
}
function normalizeVectorLayers(metadata){
  const raw=Array.isArray(metadata?.vector_layers)?metadata.vector_layers:[];
  return raw.map(layer=>typeof layer==='string'?{id:layer}:{id:layer?.id,fields:layer?.fields||{},minzoom:layer?.minzoom,maxzoom:layer?.maxzoom})
    .filter(layer=>typeof layer.id==='string'&&layer.id.trim());
}

function mapRevisionId(pkgId){
  const base=String(pkgId||'race').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,80);
  const nonce=globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  return `${base}@${nonce}`;
}

export async function discardOfflineMapRevision(meta,fallbackId=null){
  const storageId=meta?.storageId || fallbackId;
  if(storageId) await deleteMapTiles(storageId);
}

export async function downloadOfflineMap(pkg,onProgress=()=>{}){
  if(!window.pmtiles?.PMTiles) throw new Error('Библиотека PMTiles не загрузилась. Открой приложение онлайн и обнови страницу.');
  const plan=buildDownloadPlan(pkg.geojson);
  const storageId=mapRevisionId(pkg.id);
  await deleteMapTiles(storageId);

  try{
    const archive=new window.pmtiles.PMTiles(SOURCE_URL);
    const [header,metadata]=await Promise.all([archive.getHeader(),archive.getMetadata().catch(()=>({}))]);
    const vectorLayers=normalizeVectorLayers(metadata);
    let done=0,saved=0,bytes=0,failed=0; const started=Date.now();
    const queue=[...plan.tiles];

    async function worker(){
      while(queue.length){
        const t=queue.shift();
        try{
          const result=await archive.getZxy(t.z,t.x,t.y);
          const data=normalizeTileData(result?.data);
          if(data?.byteLength){ await saveMapTile(storageId,t.z,t.x,t.y,data); saved++; bytes+=data.byteLength; }
        }catch(e){ failed++; console.warn('offline tile failed',t,e); }
        done++; onProgress({done,total:plan.tiles.length,saved,bytes,failed,maxZoom:plan.maxZoom});
      }
    }

    await Promise.all(Array.from({length:Math.min(6,queue.length)},()=>worker()));
    if(!saved) throw new Error('Не удалось скачать ни одного тайла подложки');
    if(failed) throw new Error(`Не удалось скачать ${failed} из ${plan.tiles.length} тайлов. Старая карта сохранена.`);

    return {
      ready:true,
      storageId,
      tileCount:saved,
      requested:plan.tiles.length,
      bytes,
      failed,
      bounds:plan.bounds,
      minZoom:plan.minZoom,
      maxZoom:plan.maxZoom,
      downloadedAt:new Date().toISOString(),
      source:'Protomaps / OpenStreetMap',
      sourceTileType:header?.tileType??null,
      vectorLayers,
      metadataName:metadata?.name||null,
      metadataVersion:metadata?.version||null,
      elapsedMs:Date.now()-started
    };
  }catch(error){
    try{ await deleteMapTiles(storageId); }catch(cleanupError){ console.warn('Could not remove failed offline map revision',cleanupError); }
    throw error;
  }
}
export async function removeOfflineMap(pkg){
  const currentId=pkg?.offlineMap?.storageId || pkg?.id;
  if(currentId) await deleteMapTiles(currentId);
  // Older installs stored tiles directly under pkg.id. Clear that legacy namespace too.
  if(pkg?.id && pkg.id!==currentId) await deleteMapTiles(pkg.id);
}

export function registerOfflineMapProtocol(){
  if(protocolRegistered || !window.maplibregl) return;
  window.maplibregl.addProtocol('rfmoffline', async params => {
    try{
      const raw=params.url.replace(/^rfmoffline:\/\//,'');
      const [raceId,z,x,yPart]=raw.split('/'); const y=String(yPart||'').split(/[?#]/)[0];
      const rec=await getMapTile(decodeURIComponent(raceId),Number(z),Number(x),Number(y));
      if(!rec?.data){ emit('miss',{raceId,z:Number(z),x:Number(x),y:Number(y)}); return {data:new ArrayBuffer(0)}; }
      const data=normalizeTileData(rec.data);
      emit('hit',{raceId,z:Number(z),x:Number(x),y:Number(y),bytes:data?.byteLength||0});
      return {data};
    }catch(error){
      emit('error',{message:String(error?.message||error)});
      console.error('offline map protocol failed',error);
      return {data:new ArrayBuffer(0)};
    }
  });
  protocolRegistered=true;
}

export function offlineVectorSource(raceId,meta={}){
  const source={
    type:'vector',
    tiles:[`rfmoffline://${encodeURIComponent(raceId)}/{z}/{x}/{y}`],
    minzoom:meta.minZoom||MIN_ZOOM,
    maxzoom:meta.maxZoom||14,
    attribution:'© OpenStreetMap contributors · Protomaps'
  };
  const b=meta.bounds;
  if(b && [b.minLon,b.minLat,b.maxLon,b.maxLat].every(Number.isFinite)) source.bounds=[b.minLon,b.minLat,b.maxLon,b.maxLat];
  return source;
}
