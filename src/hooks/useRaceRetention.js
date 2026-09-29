import { useCallback, useEffect, useRef, useState } from 'react';
import { deletePackage } from '../db.js';
import { assetUrl } from '../rallyfans.js';
import { removeOfflineMap } from '../offline-map.js';
import { removeTerrain } from '../terrain-offline.js';
import { removePackageFavorites } from '../app/local-points.js';
import { completedRallyPacks, deleteStoredRallyPack } from '../app/race-retention.js';
import { loadAutoDeleteCompletedRaces, saveAutoDeleteCompletedRaces } from '../app/preferences.js';

export function useRaceRetention({
  packages,
  currentPackage,
  setCurrentPackage,
  setSelectedPoint,
  refreshPackages,
}) {
  const [autoDeleteCompletedRaces, setAutoDeleteCompletedRacesState] = useState(
    loadAutoDeleteCompletedRaces,
  );
  const deletingCompletedRef = useRef(false);

  const setAutoDeleteCompletedRaces = useCallback(enabled => {
    setAutoDeleteCompletedRacesState(saveAutoDeleteCompletedRaces(enabled));
  }, []);

  const deleteStoredRace = useCallback(
    pkg =>
      deleteStoredRallyPack(pkg, {
        packages,
        removeOfflineMap,
        removeTerrain,
        deletePackage,
        removeFavorites: removePackageFavorites,
        deleteCachedAsset: async asset => {
          if (!('caches' in window)) return;
          const cache = await caches.open('rfm-race-assets-v1');
          await cache.delete(assetUrl(asset));
        },
      }),
    [packages],
  );

  const deleteRace = useCallback(
    async id => {
      const pkg = packages.find(item => item.id === id);
      if (!pkg || !confirm(`Удалить скачанную гонку «${pkg.name}» с этого устройства?`)) return;
      try {
        await deleteStoredRace(pkg);
        if (currentPackage?.id === pkg.id) {
          setCurrentPackage(null);
          setSelectedPoint(null);
        }
        await refreshPackages();
      } catch (error) {
        alert(`Не удалось удалить гонку: ${error.message}`);
      }
    },
    [
      packages,
      currentPackage?.id,
      deleteStoredRace,
      refreshPackages,
      setCurrentPackage,
      setSelectedPoint,
    ],
  );

  useEffect(() => {
    if (!autoDeleteCompletedRaces) return undefined;
    let cancelled = false;
    const deleteFinished = async () => {
      if (cancelled || deletingCompletedRef.current) return;
      const finished = completedRallyPacks(packages);
      if (!finished.length) return;
      deletingCompletedRef.current = true;
      const ids = new Set();
      try {
        for (const pkg of finished) {
          try {
            await deleteStoredRace(pkg);
            ids.add(pkg.id);
          } catch (error) {
            console.warn('Could not automatically delete a completed Rally Pack', pkg.id, error);
          }
        }
        if (ids.size) {
          if (ids.has(currentPackage?.id)) {
            setCurrentPackage(null);
            setSelectedPoint(null);
          }
          await refreshPackages();
        }
      } finally {
        deletingCompletedRef.current = false;
      }
    };
    void deleteFinished();
    const timer = setInterval(deleteFinished, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    autoDeleteCompletedRaces,
    packages,
    currentPackage?.id,
    deleteStoredRace,
    refreshPackages,
    setCurrentPackage,
    setSelectedPoint,
  ]);

  return { autoDeleteCompletedRaces, setAutoDeleteCompletedRaces, deleteRace };
}
