import { geometryBounds } from './normalize.js';
import { saveMapTile, getMapTile, deleteMapTiles } from './db.js';
import { downloadTileRevision, normalizeTileData } from './tile-revision-downloader.js';

const SOURCE_URL='/api/basemap.pmtiles';
const MIN_ZOOM=6;
const DESIRED_MAX_ZOOM=14;
const MAX_TILES=2200;
const DOWNLOAD_CONCURRENCY=10;
const TILE_DOWNLOAD_ATTEMPTS=3;
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
function normalizeVectorLayers(metadata){
  const raw=Array.isArray(metadata?.vector_layers)?metadata.vector_layers:[];
  return raw.map(layer=>typeof layer==='string'?{id:layer}:{id:layer?.id,fields:layer?.fields||{},minzoom:layer?.minzoom,maxzoom:layer?.maxzoom})
    .filter(layer=>typeof layer.id==='string'&&layer.id.trim());
}

function mapRevisionId(pkgId,previousMap=null){
  const base=String(pkgId||'race').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,80);
  const previous=String(previousMap?.storageId||'');
  const slot=previous===`${base}@slot-a`?'slot-b':'slot-a';
  return `${base}@${slot}`;
}

export async function discardOfflineMapRevision(meta,fallbackId=null){
  const storageId=meta?.storageId || fallbackId;
  if(storageId) await deleteMapTiles(storageId);
}

export async function downloadOfflineMap(pkg,onProgress=()=>{},{previousMap=null}={}){
  if(!window.pmtiles?.PMTiles) throw new Error('Библиотека PMTiles не загрузилась. Открой приложение онлайн и обнови страницу.');
  const plan=buildDownloadPlan(pkg.geojson);
  const storageId=mapRevisionId(pkg.id,previousMap);

  const archive=new window.pmtiles.PMTiles(SOURCE_URL);
  const [header,metadata]=await Promise.all([archive.getHeader(),archive.getMetadata().catch(()=>({}))]);
  const vectorLayers=normalizeVectorLayers(metadata);
  const started=Date.now();
  const stats=await downloadTileRevision({
    tiles:plan.tiles,
    storageId,
    getTile:getMapTile,
    fetchTile:tile=>archive.getZxy(tile.z,tile.x,tile.y),
    saveTile:saveMapTile,
    concurrency:DOWNLOAD_CONCURRENCY,
    retries:TILE_DOWNLOAD_ATTEMPTS,
    retryDelayMs:150,
    resume:true,
    onProgress,
    maxZoom:plan.maxZoom
  }).catch(error=>{
    if(!error.stats) throw error;
    console.warn('offline map revision download incomplete',error.stats||{},error);
    throw new Error(`Не удалось скачать ${error.stats.failed} из ${plan.tiles.length} тайлов. Уже загруженные тайлы сохранены — повторная попытка продолжит загрузку.`,{cause:error});
  });
  const {saved,bytes,reused,failed}=stats;

  return {
    ready:true,
    storageId,
    tileCount:saved,
    requested:plan.tiles.length,
    bytes,
    failed,
    reused,
    resumable:true,
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
export async function removeOfflineMap(pkg){
  const currentId=pkg?.offlineMap?.storageId || pkg?.id;
  if(currentId) await deleteMapTiles(currentId);
  // Older installs stored tiles directly under pkg.id. Clear that legacy namespace too.
  if(pkg?.id && pkg.id!==currentId) await deleteMapTiles(pkg.id);
}

export function registerOfflineMapProtocol(){
  if(protocolRegistered || !window.maplibregl) return;
  window.maplibregl.addProtocol('rfmoffline', async (params,abortController) => {
    try{
      abortController?.signal.throwIfAborted();
      const raw=params.url.replace(/^rfmoffline:\/\//,'');
      const [raceId,z,x,yPart]=raw.split('/'); const y=String(yPart||'').split(/[?#]/)[0];
      const rec=await getMapTile(decodeURIComponent(raceId),Number(z),Number(x),Number(y));
      abortController?.signal.throwIfAborted();
      const data=normalizeTileData(rec?.data);
      if(!data?.byteLength){
        emit('miss',{raceId,z:Number(z),x:Number(x),y:Number(y)});
        // A successful empty vector tile replaces the visible parent with a blank
        // tile. Keep this request failed so MapLibre can retain its fallback.
        throw new Error(`Offline map tile unavailable: ${z}/${x}/${y}`);
      }
      emit('hit',{raceId,z:Number(z),x:Number(x),y:Number(y),bytes:data?.byteLength||0});
      return {data};
    }catch(error){
      if(abortController?.signal.aborted) throw error;
      emit('error',{message:String(error?.message||error)});
      console.error('offline map protocol failed',error);
      throw error;
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
