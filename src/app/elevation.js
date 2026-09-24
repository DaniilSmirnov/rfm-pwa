import { getMapTile } from '../db.js';

const tileCache=new Map();

export function terrariumElevation(r,g,b){
  return (Number(r)*256+Number(g)+Number(b)/256)-32768;
}

export function terrainPixel(lat,lon,z,tileSize=512){
  const scale=2**z;
  const xWorld=(Number(lon)+180)/360*scale;
  const latRad=Math.max(-85.05112878,Math.min(85.05112878,Number(lat)))*Math.PI/180;
  const yWorld=(1-Math.asinh(Math.tan(latRad))/Math.PI)/2*scale;
  const x=Math.floor(xWorld), y=Math.floor(yWorld);
  return {
    z,x,y,
    px:Math.max(0,Math.min(tileSize-1,Math.floor((xWorld-x)*tileSize))),
    py:Math.max(0,Math.min(tileSize-1,Math.floor((yWorld-y)*tileSize)))
  };
}

async function decodeTile(storageId,z,x,y,tileSize){
  const key=`${storageId}:${z}:${x}:${y}`;
  if(tileCache.has(key)) return tileCache.get(key);
  const promise=(async()=>{
    const rec=await getMapTile(storageId,z,x,y);
    if(!rec?.data) return null;
    const blob=new Blob([rec.data],{type:'image/webp'});
    const bitmap=await createImageBitmap(blob);
    const canvas=typeof OffscreenCanvas!=='undefined'
      ? new OffscreenCanvas(tileSize,tileSize)
      : Object.assign(document.createElement('canvas'),{width:tileSize,height:tileSize});
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0,tileSize,tileSize);
    bitmap.close?.();
    return ctx.getImageData(0,0,tileSize,tileSize).data;
  })();
  tileCache.set(key,promise);
  return promise;
}

export async function elevationAt(meta,point){
  if(!meta?.ready || !meta.storageId) return null;
  const z=Number(meta.maxZoom)||12;
  const tileSize=Number(meta.tileSize)||512;
  const t=terrainPixel(point.lat,point.lon,z,tileSize);
  const pixels=await decodeTile(meta.storageId,t.z,t.x,t.y,tileSize);
  if(!pixels) return null;
  const i=(t.py*tileSize+t.px)*4;
  if(i<0 || i+2>=pixels.length) return null;
  return terrariumElevation(pixels[i],pixels[i+1],pixels[i+2]);
}

function haversine(a,b){
  const R=6371000,toRad=v=>v*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const s=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
}

export function routeCoordinates(geometry){
  if(geometry?.type==='LineString') return geometry.coordinates||[];
  if(geometry?.type==='MultiLineString') return (geometry.coordinates||[]).flat();
  return [];
}

export function sampleRouteCoordinates(geometry,maxSamples=96){
  const raw=routeCoordinates(geometry).filter(c=>Array.isArray(c)&&Number.isFinite(Number(c[0]))&&Number.isFinite(Number(c[1])));
  if(raw.length<2) return [];
  const pts=raw.map(c=>({lon:Number(c[0]),lat:Number(c[1])}));
  const segments=[]; let total=0;
  for(let i=1;i<pts.length;i++){const d=haversine(pts[i-1],pts[i]);segments.push(d);total+=d;}
  if(!total) return [{...pts[0],distance:0}];
  const count=Math.max(2,Math.min(maxSamples,Math.ceil(total/150)+1));
  const out=[];
  for(let n=0;n<count;n++){
    const target=total*n/(count-1);
    let walked=0,index=0;
    while(index<segments.length-1 && walked+segments[index]<target){walked+=segments[index];index++;}
    const seg=segments[index]||1, ratio=Math.max(0,Math.min(1,(target-walked)/seg));
    const a=pts[index],b=pts[index+1]||a;
    out.push({lat:a.lat+(b.lat-a.lat)*ratio,lon:a.lon+(b.lon-a.lon)*ratio,distance:target});
  }
  return out;
}

export async function elevationProfile(meta,geometry){
  const samples=sampleRouteCoordinates(geometry);
  const points=[];
  for(const sample of samples){
    const elevation=await elevationAt(meta,sample);
    if(Number.isFinite(elevation)) points.push({...sample,elevation});
  }
  if(points.length<2) return {points:[],distance:0,min:null,max:null,gain:0,loss:0};
  let gain=0,loss=0;
  for(let i=1;i<points.length;i++){
    const delta=points[i].elevation-points[i-1].elevation;
    if(delta>0) gain+=delta; else loss+=Math.abs(delta);
  }
  return {
    points,
    distance:points.at(-1).distance,
    min:Math.min(...points.map(p=>p.elevation)),
    max:Math.max(...points.map(p=>p.elevation)),
    gain,loss
  };
}
