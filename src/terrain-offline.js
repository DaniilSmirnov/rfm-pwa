import { geometryBounds } from './normalize.js';
import { saveMapTile, getMapTile, deleteMapTiles } from './db.js';
import { downloadTileRevision } from './tile-revision-downloader.js';
import { fetchWithTimeout } from './app/net.js';

const TERRAIN_URL='/api/terrain';
const MIN_ZOOM=6;
const MAX_ZOOM=12;
const MAX_TILES=1800;
let protocolRegistered=false;

function clampLat(lat){ return Math.max(-85.05112878,Math.min(85.05112878,lat)); }
function lon2x(lon,z){ return Math.floor((lon+180)/360*(2**z)); }
function lat2y(lat,z){ const r=clampLat(lat)*Math.PI/180; return Math.floor((1-Math.asinh(Math.tan(r))/Math.PI)/2*(2**z)); }

export function terrainBounds(fc){
  const b=geometryBounds(fc);
  if(!b) return null;
  const dx=Math.max(b.maxLon-b.minLon,.02), dy=Math.max(b.maxLat-b.minLat,.02);
  const padLon=Math.max(.05,dx*.22), padLat=Math.max(.04,dy*.22);
  return {minLon:b.minLon-padLon,maxLon:b.maxLon+padLon,minLat:b.minLat-padLat,maxLat:b.maxLat+padLat};
}

function tileRange(bounds,z){
  const n=2**z;
  const x0=Math.max(0,lon2x(bounds.minLon,z)), x1=Math.min(n-1,lon2x(bounds.maxLon,z));
  const y0=Math.max(0,lat2y(bounds.maxLat,z)), y1=Math.min(n-1,lat2y(bounds.minLat,z));
  return {x0,x1,y0,y1,count:Math.max(0,x1-x0+1)*Math.max(0,y1-y0+1)};
}

function tilesAtZoom(bounds,z){
  const {x0,x1,y0,y1}=tileRange(bounds,z);
  const out=[];
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) out.push({z,x,y});
  return out;
}

export function buildTerrainDownloadPlan(fc){
  const bounds=terrainBounds(fc);
  if(!bounds) throw new Error('У гонки нет геометрии для определения района рельефа');

  for(let maxZoom=MAX_ZOOM;maxZoom>=MIN_ZOOM;maxZoom--){
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
  throw new Error(`Район слишком большой для загрузки рельефа (лимит ${MAX_TILES} DEM-тайлов)`);
}

function terrainRevisionId(pkgId){
  const base=String(pkgId||'race').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,70);
  const nonce=globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  return `${base}@terrain@${nonce}`;
}

export async function downloadTerrain(pkg,onProgress=()=>{}){
  const plan=buildTerrainDownloadPlan(pkg.geojson);
  const storageId=terrainRevisionId(pkg.id);
  await deleteMapTiles(storageId);

  const started=Date.now();

  try{
    const stats=await downloadTileRevision({
      tiles:plan.tiles,
      storageId,
      getTile:getMapTile,
      fetchTile:async tile=>{
        const response=await fetchWithTimeout(`${TERRAIN_URL}/${tile.z}/${tile.x}/${tile.y}.webp`,{cache:'no-store'},12_000);
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      },
      saveTile:saveMapTile,
      deleteRevision:deleteMapTiles,
      concurrency:6,
      retries:1,
      resume:false,
      cleanupOnFailure:true,
      onProgress,
      maxZoom:plan.maxZoom
    });
    const {saved,bytes,failed}=stats;

    return {
      ready:true,
      storageId,
      tileCount:saved,
      requested:plan.tiles.length,
      bytes,
      failed:0,
      bounds:plan.bounds,
      minZoom:plan.minZoom,
      maxZoom:plan.maxZoom,
      encoding:'terrarium',
      tileSize:512,
      downloadedAt:new Date().toISOString(),
      source:'Mapterhorn',
      elapsedMs:Date.now()-started
    };
  }catch(error){
    throw error;
  }
}

export async function discardTerrainRevision(meta){
  if(meta?.storageId) await deleteMapTiles(meta.storageId);
}

export async function removeTerrain(pkg){
  if(pkg?.terrain?.storageId) await deleteMapTiles(pkg.terrain.storageId);
}

export function registerTerrainProtocol(){
  if(protocolRegistered || !window.maplibregl) return;
  window.maplibregl.addProtocol('rfmterrain',async params=>{
    try{
      const raw=params.url.replace(/^rfmterrain:\/\//,'');
      const [storageId,z,x,yPart]=raw.split('/');
      const y=String(yPart||'').split(/[?#]/)[0];
      const rec=await getMapTile(decodeURIComponent(storageId),Number(z),Number(x),Number(y));
      return {data:rec?.data ? normalizeTileData(rec.data) : new ArrayBuffer(0)};
    }catch(error){
      console.error('offline terrain protocol failed',error);
      return {data:new ArrayBuffer(0)};
    }
  });
  protocolRegistered=true;
}

export function offlineTerrainSource(meta){
  if(!meta?.ready || !meta.storageId) return null;
  const source={
    type:'raster-dem',
    tiles:[`rfmterrain://${encodeURIComponent(meta.storageId)}/{z}/{x}/{y}`],
    minzoom:Number(meta.minZoom)||MIN_ZOOM,
    maxzoom:Number(meta.maxZoom)||MAX_ZOOM,
    tileSize:Number(meta.tileSize)||512,
    encoding:meta.encoding||'terrarium',
    attribution:'© Mapterhorn'
  };
  const b=meta.bounds;
  if(b && [b.minLon,b.minLat,b.maxLon,b.maxLat].every(Number.isFinite)) source.bounds=[b.minLon,b.minLat,b.maxLon,b.maxLat];
  return source;
}
