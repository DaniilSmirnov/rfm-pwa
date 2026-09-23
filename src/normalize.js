const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function hashId(input) {
  let h = 2166136261;
  for (const ch of input) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `pkg-${(h >>> 0).toString(16)}`;
}

export function collectGeoJson(input) {
  const features = [];
  const visit = node => {
    if (!node) return;
    if (node.type === 'FeatureCollection' && Array.isArray(node.features)) {
      node.features.forEach(visit); return;
    }
    if (node.type === 'Feature' && node.geometry) { features.push(node); return; }
    if (node.type && node.coordinates && ['Point','LineString','MultiLineString','Polygon','MultiPolygon'].includes(node.type)) {
      features.push({type:'Feature', properties:{}, geometry:node}); return;
    }
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (isObj(node)) Object.values(node).forEach(visit);
  };
  visit(input);
  return {type:'FeatureCollection', features};
}

function firstString(obj, keys) {
  for (const k of keys) if (typeof obj?.[k] === 'string' && obj[k].trim()) return obj[k].trim();
  return null;
}

export function normalizePackage(input, source = 'import') {
  const geojson = collectGeoJson(input);
  const inferredName = firstString(input, ['name','title','eventName','raceName','rallyName']) ||
    firstString(geojson.features[0]?.properties, ['event','rally','race','name']) || 'Импортированный пакет';
  const raw = JSON.stringify(input);
  return {
    id: hashId(`${inferredName}:${raw.length}:${raw.slice(0,256)}`),
    name: inferredName,
    source,
    savedAt: new Date().toISOString(),
    size: new Blob([raw]).size,
    original: input,
    geojson
  };
}

export function geometryBounds(featureCollection) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const consume = coords => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lon, lat] = coords; minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); return;
    }
    coords.forEach(consume);
  };
  for (const f of featureCollection?.features || []) consume(f.geometry?.coordinates);
  return Number.isFinite(minLon) ? {minLon,minLat,maxLon,maxLat} : null;
}
