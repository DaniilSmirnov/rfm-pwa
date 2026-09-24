const DEFAULT_TILE_SIZE=512;

function clampLat(lat){
  return Math.max(-85.05112878,Math.min(85.05112878,lat));
}

function mercatorX(lon){
  return (lon+180)/360;
}

function mercatorY(lat){
  const r=clampLat(lat)*Math.PI/180;
  return (1-Math.asinh(Math.tan(r))/Math.PI)/2;
}

export function offlineMapBounds(meta){
  if(!meta?.ready) return null;
  const b=meta.bounds;
  if(!b) return null;
  const values=[b.minLon,b.minLat,b.maxLon,b.maxLat].map(Number);
  if(!values.every(Number.isFinite)) return null;
  const [minLon,minLat,maxLon,maxLat]=values;
  if(minLon>=maxLon || minLat>=maxLat) return null;
  return [[minLon,minLat],[maxLon,maxLat]];
}

export function minimumZoomForBounds(bounds,{width,height}={},tileSize=DEFAULT_TILE_SIZE){
  if(!bounds || !Number.isFinite(width) || !Number.isFinite(height) || width<=0 || height<=0) return null;
  const [[west,south],[east,north]]=bounds;
  const spanX=Math.abs(mercatorX(east)-mercatorX(west))*tileSize;
  const spanY=Math.abs(mercatorY(north)-mercatorY(south))*tileSize;
  if(spanX<=0 || spanY<=0) return null;
  return Math.max(Math.log2(width/spanX),Math.log2(height/spanY),0);
}

export function offlineViewportOptions(meta){
  const bounds=offlineMapBounds(meta);
  if(!bounds) return {};
  const minZoom=Number(meta?.minZoom);
  return {
    maxBounds:bounds,
    ...(Number.isFinite(minZoom)?{minZoom}: {})
  };
}

export function applyOfflineViewportConstraints(map,meta){
  const bounds=offlineMapBounds(meta);
  if(!bounds || !map) return null;

  map.setMaxBounds?.(bounds);
  const container=map.getContainer?.();
  const viewport={
    width:Number(container?.clientWidth),
    height:Number(container?.clientHeight)
  };
  const coverageZoom=minimumZoomForBounds(bounds,viewport);
  const tileMinZoom=Number(meta?.minZoom);
  let minZoom=Math.max(Number.isFinite(tileMinZoom)?tileMinZoom:0,Number.isFinite(coverageZoom)?coverageZoom:0);
  const maxZoom=Number(map.getMaxZoom?.());
  if(Number.isFinite(maxZoom)) minZoom=Math.min(minZoom,maxZoom);

  map.setMinZoom?.(minZoom);
  const currentZoom=Number(map.getZoom?.());
  if(Number.isFinite(currentZoom) && currentZoom<minZoom) map.setZoom?.(minZoom);
  return {bounds,minZoom};
}
