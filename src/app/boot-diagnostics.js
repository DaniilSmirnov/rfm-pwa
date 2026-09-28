import { getAllPackages, getMapStorageStats, getLegacyMapTileCount, getMapTile } from '../db.js';
import { buildDownloadPlan } from '../offline-map.js';
import { buildTerrainDownloadPlan } from '../terrain-offline.js';
import { inspectOfflineRevisionSamples } from './offline-diagnostics.js';

const startedAt = performance.now();
const marks = [];
let storageSnapshot = null;
let refreshPromise = null;

function snapshotMeta() {
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  return {
    online: navigator.onLine,
    visibility: document.visibilityState,
    navigationType: nav?.type || 'unknown',
    domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd || 0),
    loadEventMs: Math.round(nav?.loadEventEnd || 0),
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    displayMode:
      ['standalone', 'fullscreen', 'minimal-ui'].find(
        mode => window.matchMedia?.(`(display-mode: ${mode})`).matches,
      ) || 'browser',
    userAgent: navigator.userAgent,
  };
}

export function markBoot(name, detail = null) {
  const entry = { name, ms: Math.round(performance.now() - startedAt), detail };
  marks.push(entry);
  window.dispatchEvent(new CustomEvent('rfm:boot-mark', { detail: entry }));
  return entry;
}

export function bootSnapshot() {
  return { startedAt, marks: [...marks], meta: snapshotMeta(), storage: storageSnapshot };
}

export async function collectStorageDiagnostics() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const warnings = [];
    const [packages, tiles, legacyTiles, estimate, persisted, cachesList] = await Promise.all([
      getAllPackages(),
      getMapStorageStats(),
      getLegacyMapTileCount(),
      navigator.storage?.estimate?.().catch(() => null) ?? null,
      navigator.storage?.persisted?.().catch(() => false) ?? false,
      'caches' in window ? caches.keys().catch(() => []) : Promise.resolve([]),
    ]);
    const readyMaps = packages.filter(pkg => pkg?.offlineMap?.ready);
    const readyTerrain = packages.filter(pkg => pkg?.terrain?.ready);
    const invalidReferences = packages
      .filter(
        pkg =>
          (pkg?.offlineMap?.ready && !pkg.offlineMap.storageId) ||
          (pkg?.terrain?.ready && !pkg.terrain.storageId),
      )
      .map(pkg => pkg?.name || pkg?.id);
    if (invalidReferences.length)
      warnings.push(
        `У ${invalidReferences.length} пакетов отсутствует storageId у готовой карты/рельефа.`,
      );
    if (tiles.count === 0 && (readyMaps.length || readyTerrain.length))
      warnings.push('Метаданные ссылаются на офлайн-тайлы, но их учётное количество равно нулю.');
    if (estimate?.quota && estimate.quota - estimate.usage < 50 * 1024 * 1024)
      warnings.push('Свободно менее 50 МБ браузерного хранилища.');
    const [cacheEntries, revisionSamples] = await Promise.all([
      Promise.all(
        cachesList.map(async name => {
          try {
            return { name, count: (await (await caches.open(name)).keys()).length };
          } catch (error) {
            warnings.push(`Не удалось прочитать кэш ${name}: ${error?.message || error}`);
            return { name, count: null };
          }
        }),
      ),
      inspectOfflineRevisionSamples(packages, {
        getTile: getMapTile,
        buildMapPlan: buildDownloadPlan,
        buildTerrainPlan: buildTerrainDownloadPlan,
      }),
    ]);
    if (revisionSamples.samples.some(item => item.missing))
      warnings.push(
        'Не все проверочные тайлы офлайн-ревизий найдены. Обнови или скачай карту/рельеф повторно.',
      );
    if (revisionSamples.samples.some(item => item.error))
      warnings.push('Не удалось полностью проверить одну или несколько офлайн-ревизий.');
    storageSnapshot = {
      checkedAt: new Date().toISOString(),
      indexedDb: { name: 'rallyfans-offline', packages: packages.length, legacyTiles },
      offline: {
        readyMaps: readyMaps.length,
        readyTerrain: readyTerrain.length,
        metadataTiles: tiles.count,
        metadataBytes: tiles.bytes,
      },
      browserStorage: {
        supported: Boolean(navigator.storage),
        persisted: Boolean(persisted),
        usageBytes: estimate?.usage ?? null,
        quotaBytes: estimate?.quota ?? null,
      },
      caches: cacheEntries,
      revisionSamples,
      warnings,
    };
    return storageSnapshot;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

markBoot('app-script-start');
