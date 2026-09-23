import { hashId } from './normalize.js';
import { fetchYandexConstructorFeatures, yandexFeaturesToGeoJson, mergeGeoJson } from './yandex.js';

export const API_BASE = '/api/rallyfans';
export const HEALTH_URL = '/api/health';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

export function parseLatLon(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parts = value.split(',').map(v => Number(v.trim()));
  if (parts.length < 2 || !parts.every(Number.isFinite)) return null;
  const [lat, lon] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}

export function raceToGeoJson(race) {
  const features = [];
  for (const point of asArray(race.coordinates)) {
    const coordinates = parseLatLon(point.coordinates);
    if (!coordinates) continue;
    features.push({
      type: 'Feature',
      properties: {
        kind: 'race-point',
        id: point.id,
        name: point.name || 'Точка',
        color: point.color || null,
        image: point.image || null
      },
      geometry: { type: 'Point', coordinates }
    });
  }
  for (const item of asArray(race.schedule)) {
    const coordinates = parseLatLon(item.coordinates);
    if (!coordinates) continue;
    features.push({
      type: 'Feature',
      properties: {
        kind: 'schedule',
        id: item.id,
        name: item.location || 'Событие',
        date: item.date || '',
        events: asArray(item.events)
      },
      geometry: { type: 'Point', coordinates }
    });
  }
  return { type: 'FeatureCollection', features };
}

export function collectRaceAssetNames(race) {
  const names = new Set();
  const add = value => { if (typeof value === 'string' && value.trim()) names.add(value.trim()); };
  ['image','overlap_schedule','safety_leaflet','mapsimg','list_crews','list_crews2','list_crews3','list_crews4','list_crews5','results_race','results_race2','results_race3','results_race4','results_race5'].forEach(k => add(race?.[k]));
  asArray(race?.lists).forEach(x => add(x?.image));
  asArray(race?.results).forEach(x => add(x?.image));
  asArray(race?.coordinates).forEach(x => add(x?.image));
  return [...names];
}

export function raceDetailToPackage(race) {
  const geojson = raceToGeoJson(race);
  const raw = JSON.stringify(race);
  return {
    id: `race-${race.id}`,
    raceId: race.id,
    name: race.name || `Ралли #${race.id}`,
    source: `api.rallyfansmap.ru/race/${race.id}`,
    savedAt: new Date().toISOString(),
    size: new Blob([raw]).size,
    original: race,
    geojson,
    assetNames: collectRaceAssetNames(race),
    summary: {
      category: race.category_race || '',
      stage: race.stage_race || '',
      status: race.status_race || '',
      dates: race.date_race || race.dates || '',
      city: race.city_race_details || race.city_race || '',
      totalDistance: race.total_distance || '',
      combatKm: race.combat_km || '',
      days: race.days_race || ''
    },
    yandexMapEmbed: race.iframe_maps || null
  };
}

export async function checkApiHealth() {
  const r = await fetch(HEALTH_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json();
}

export async function fetchRaceCatalog() {
  const r = await fetch(`${API_BASE}/race`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function fetchRace(id) {
  const r = await fetch(`${API_BASE}/race/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export function assetUrl(name) {
  return `${API_BASE}/public/${encodeURIComponent(name)}`;
}

async function tryBackgroundFetchAssets(pkg,onProgress){
  if(!('serviceWorker' in navigator)) return null;
  const reg=await navigator.serviceWorker.ready;
  if(!reg.backgroundFetch?.fetch) return null;
  const names=pkg.assetNames||[];
  if(!names.length) return {cached:0,total:0,background:false};
  const urls=names.map(assetUrl);
  const id=`rfm-assets-${String(pkg.raceId??pkg.id).replace(/[^a-z0-9_-]+/gi,'-')}-${Date.now()}`;
  try{
    const task=await reg.backgroundFetch.fetch(id,urls,{
      title:`Rally Fans Map · ${pkg.name||'гонка'}`,
      icons:[{src:'/rfm/icon.png?v=0401',sizes:'180x180',type:'image/png'}]
    });
    task.addEventListener?.('progress',()=>{
      const total=Number(task.downloadTotal)||0;
      const done=Number(task.downloaded)||0;
      const ratio=total>0?Math.min(1,done/total):0;
      onProgress(Math.round(ratio*names.length),names.length,{background:true,downloaded:done,downloadTotal:total});
    });
    return {cached:0,total:names.length,background:true,id};
  }catch(e){
    console.warn('Background Fetch unavailable for race assets, using foreground fallback',e);
    return null;
  }
}

export async function cacheRaceAssets(pkg, onProgress = () => {}) {
  if (!('caches' in window)) return { cached: 0, total: 0 };
  const bg=await tryBackgroundFetchAssets(pkg,onProgress);
  if(bg) return bg;
  const cache = await caches.open('rfm-race-assets-v1');
  let cached = 0;
  const names = pkg.assetNames || [];
  for (let i = 0; i < names.length; i++) {
    const url = assetUrl(names[i]);
    try {
      const r = await fetch(url);
      if (r.ok) { await cache.put(url, r.clone()); cached++; }
    } catch {}
    onProgress(i + 1, names.length,{background:false});
  }
  return { cached, total: names.length, background:false };
}

export async function enrichPackageWithYandex(pkg) {
  if (!pkg?.yandexMapEmbed) return { pkg, imported: 0, status: 'no-map' };
  const data = await fetchYandexConstructorFeatures(pkg.yandexMapEmbed);
  const yandexGeoJson = yandexFeaturesToGeoJson(data.features || []);
  pkg.geojson = mergeGeoJson(pkg.geojson, yandexGeoJson);
  pkg.yandexImport = {
    importedAt: new Date().toISOString(),
    constructorUrl: data.constructorUrl || null,
    featureCount: yandexGeoJson.features.length,
    sourceFeatureCount: data.sourceFeatureCount ?? (data.features || []).length,
  };
  pkg.savedAt = new Date().toISOString();
  return { pkg, imported: yandexGeoJson.features.length, status: 'ok' };
}
