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
function tilesAtZoom(b,z){
  const n=2**z;
  const x0=Math.max(0,lon2x(b.minLon,z)), x1=Math.min(n-1,lon2x(b.maxLon,z));
  const y0=Math.max(0,lat2y(b.maxLat,z)), y1=Math.min(n-1,lat2y(b.minLat,z));
  const out=[]; for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) out.push({z,x,y}); return out;
}
export function buildDownloadPlan(fc){
  const bounds=bufferedBounds(fc); if(!bounds) throw new Error('У гонки нет геометрии для определения района карты');
  let maxZoom=DESIRED_MAX_ZOOM, tiles=[];
  while(maxZoom>=11){
    tiles=[]; for(let z=MIN_ZOOM;z<=maxZoom;z++) tiles.push(...tilesAtZoom(bounds,z));
    if(tiles.length<=MAX_TILES) break; maxZoom--;
  }
  return {bounds,minZoom:MIN_ZOOM,maxZoom,tiles};
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

export async function downloadOfflineMap(pkg,onProgress=()=>{}){
  if(!window.pmtiles?.PMTiles) throw new Error('Библиотека PMTiles не загрузилась. Открой приложение онлайн и обнови страницу.');
  const plan=buildDownloadPlan(pkg.geojson); await deleteMapTiles(pkg.id);
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
        if(data?.byteLength){ await saveMapTile(pkg.id,t.z,t.x,t.y,data); saved++; bytes+=data.byteLength; }
      }catch(e){ failed++; console.warn('offline tile failed',t,e); }
      done++; onProgress({done,total:plan.tiles.length,saved,bytes,failed,maxZoom:plan.maxZoom});
    }
  }
  await Promise.all(Array.from({length:Math.min(6,queue.length)},()=>worker()));
  if(!saved) throw new Error('Не удалось скачать ни одного тайла подложки');
  return {
    ready:true,
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
}
export async function removeOfflineMap(pkg){ await deleteMapTiles(pkg.id); }

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
