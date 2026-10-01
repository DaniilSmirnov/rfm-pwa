import { geometryBounds } from '../normalize.js';

const MAX_LATITUDE = 85.05112878;

export function clampLat(lat) {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
}

export function lon2x(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

export function lat2y(lat, zoom) {
  const radians = (clampLat(lat) * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoom);
}

export function bufferedBounds(featureCollection) {
  const bounds = geometryBounds(featureCollection);
  if (!bounds) return null;
  const dx = Math.max(bounds.maxLon - bounds.minLon, 0.02);
  const dy = Math.max(bounds.maxLat - bounds.minLat, 0.02);
  const padLon = Math.max(0.05, dx * 0.22);
  const padLat = Math.max(0.04, dy * 0.22);
  return {
    minLon: bounds.minLon - padLon,
    maxLon: bounds.maxLon + padLon,
    minLat: bounds.minLat - padLat,
    maxLat: bounds.maxLat + padLat,
  };
}

export function tileRange(bounds, zoom) {
  const size = 2 ** zoom;
  const x0 = Math.max(0, lon2x(bounds.minLon, zoom));
  const x1 = Math.min(size - 1, lon2x(bounds.maxLon, zoom));
  const y0 = Math.max(0, lat2y(bounds.maxLat, zoom));
  const y1 = Math.min(size - 1, lat2y(bounds.minLat, zoom));
  return {
    x0,
    x1,
    y0,
    y1,
    count: Math.max(0, x1 - x0 + 1) * Math.max(0, y1 - y0 + 1),
  };
}

export function tilesAtZoom(bounds, zoom) {
  const { x0, x1, y0, y1 } = tileRange(bounds, zoom);
  const tiles = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) tiles.push({ z: zoom, x, y });
  }
  return tiles;
}

export function buildTilePlan(
  featureCollection,
  { minZoom, maxZoom, maxTiles, errorMessage = 'У гонки нет геометрии для определения района' },
) {
  const bounds = bufferedBounds(featureCollection);
  if (!bounds) throw new Error(errorMessage);

  for (let selectedMaxZoom = maxZoom; selectedMaxZoom >= minZoom; selectedMaxZoom--) {
    let total = 0;
    for (let zoom = minZoom; zoom <= selectedMaxZoom; zoom++) {
      total += tileRange(bounds, zoom).count;
      if (total > maxTiles) break;
    }
    if (total > maxTiles) continue;

    const tiles = [];
    for (let zoom = minZoom; zoom <= selectedMaxZoom; zoom++) {
      tiles.push(...tilesAtZoom(bounds, zoom));
    }
    return { bounds, minZoom, maxZoom: selectedMaxZoom, tiles };
  }

  throw new Error(`Район слишком большой для загрузки (лимит ${maxTiles} тайлов)`);
}
