import { raceHasFinished } from './today-summary.js';

export function filterSavedRaces(packages, query) {
  const value = String(query || '')
    .trim()
    .toLocaleLowerCase();
  if (!value) return [...(packages || [])];
  return (packages || []).filter(pkg =>
    [pkg.name, pkg.summary?.stage, pkg.summary?.dates, pkg.summary?.city]
      .filter(Boolean)
      .some(text => String(text).toLocaleLowerCase().includes(value)),
  );
}

export function completedRallyPacks(packages, now = new Date()) {
  return (packages || []).filter(pkg => raceHasFinished(pkg, now));
}

export async function deleteStoredRallyPack(pkg, deps) {
  await deps.removeOfflineMap(pkg);
  await deps.removeTerrain(pkg);

  const siblingAssets = new Set(
    (deps.packages || []).filter(item => item.id !== pkg.id).flatMap(item => item.assetNames || []),
  );
  for (const asset of pkg.assetNames || []) {
    if (siblingAssets.has(asset)) continue;
    try {
      await deps.deleteCachedAsset?.(asset);
    } catch (error) {
      console.warn('Could not delete cached Rally Pack asset', asset, error);
    }
  }

  await deps.deletePackage(pkg.id);
  deps.removeFavorites?.(pkg.id);
}

export async function deleteCompletedRallyPacks(packages, now, deletePack) {
  const removed = [];
  for (const pkg of completedRallyPacks(packages, now)) {
    await deletePack(pkg);
    removed.push(pkg);
  }
  return removed;
}
