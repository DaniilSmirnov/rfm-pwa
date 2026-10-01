import { saveMapTile, getMapTile, deleteMapTiles } from './db.js';
import { downloadTileRevision, normalizeTileData } from './tile-revision-downloader.js';
import { fetchWithTimeout } from './app/net.js';
import { bufferedBounds, buildTilePlan } from './app/tile-grid.js';

const TERRAIN_URL = '/api/terrain';
const MIN_ZOOM = 6;
const MAX_ZOOM = 12;
const MAX_TILES = 1800;
let protocolRegistered = false;

export function terrainBounds(fc) {
  return bufferedBounds(fc);
}

export function buildTerrainDownloadPlan(fc) {
  return buildTilePlan(fc, {
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxTiles: MAX_TILES,
    errorMessage: 'У гонки нет геометрии для определения района рельефа',
  });
}

function terrainRevisionId(pkgId) {
  const base = String(pkgId || 'race')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 70);
  const nonce =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${base}@terrain@${nonce}`;
}

export async function downloadTerrain(pkg, onProgress = () => {}) {
  const plan = buildTerrainDownloadPlan(pkg.geojson);
  const storageId = terrainRevisionId(pkg.id);
  await deleteMapTiles(storageId);

  const started = Date.now();

  try {
    const stats = await downloadTileRevision({
      tiles: plan.tiles,
      storageId,
      getTile: getMapTile,
      fetchTile: async tile => {
        const response = await fetchWithTimeout(
          `${TERRAIN_URL}/${tile.z}/${tile.x}/${tile.y}.webp`,
          { cache: 'no-store' },
          12_000,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      },
      saveTile: saveMapTile,
      deleteRevision: deleteMapTiles,
      concurrency: 6,
      retries: 1,
      resume: false,
      cleanupOnFailure: true,
      onProgress,
      maxZoom: plan.maxZoom,
    });
    const { saved, bytes } = stats;

    return {
      ready: true,
      storageId,
      tileCount: saved,
      requested: plan.tiles.length,
      bytes,
      failed: 0,
      bounds: plan.bounds,
      minZoom: plan.minZoom,
      maxZoom: plan.maxZoom,
      encoding: 'terrarium',
      tileSize: 512,
      downloadedAt: new Date().toISOString(),
      source: 'Mapterhorn',
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    throw error;
  }
}

export async function discardTerrainRevision(meta) {
  if (meta?.storageId) await deleteMapTiles(meta.storageId);
}

export async function removeTerrain(pkg) {
  if (pkg?.terrain?.storageId) await deleteMapTiles(pkg.terrain.storageId);
}

export function registerTerrainProtocol() {
  if (protocolRegistered || !window.maplibregl) return;
  window.maplibregl.addProtocol('rfmterrain', async params => {
    try {
      const raw = params.url.replace(/^rfmterrain:\/\//, '');
      const [storageId, z, x, yPart] = raw.split('/');
      const y = String(yPart || '').split(/[?#]/)[0];
      const rec = await getMapTile(decodeURIComponent(storageId), Number(z), Number(x), Number(y));
      return { data: rec?.data ? normalizeTileData(rec.data) : new ArrayBuffer(0) };
    } catch (error) {
      console.error('offline terrain protocol failed', error);
      return { data: new ArrayBuffer(0) };
    }
  });
  protocolRegistered = true;
}

export function offlineTerrainSource(meta) {
  if (!meta?.ready || !meta.storageId) return null;
  const source = {
    type: 'raster-dem',
    tiles: [`rfmterrain://${encodeURIComponent(meta.storageId)}/{z}/{x}/{y}`],
    minzoom: Number(meta.minZoom) || MIN_ZOOM,
    maxzoom: Number(meta.maxZoom) || MAX_ZOOM,
    tileSize: Number(meta.tileSize) || 512,
    encoding: meta.encoding || 'terrarium',
    attribution: '© Mapterhorn',
  };
  const b = meta.bounds;
  if (b && [b.minLon, b.minLat, b.maxLon, b.maxLat].every(Number.isFinite))
    source.bounds = [b.minLon, b.minLat, b.maxLon, b.maxLat];
  return source;
}
