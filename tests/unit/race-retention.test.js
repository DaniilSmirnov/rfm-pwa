import { describe, expect, it, vi } from 'vitest';
import {
  completedRallyPacks,
  deleteCompletedRallyPacks,
  deleteStoredRallyPack,
  filterSavedRaces,
} from '../../src/app/race-retention.js';

const now = new Date('2026-09-28T12:00:00');
const packages = [
  {
    id: 'race-1',
    raceId: 1,
    name: 'Карелия',
    assetNames: ['shared.jpg', 'old-map.jpg'],
    summary: { dates: '27.09.2026' },
    original: { status_race: 'Завершена' },
  },
  {
    id: 'race-2',
    raceId: 2,
    name: 'Псков',
    assetNames: ['shared.jpg'],
    summary: { stage: 'Кубок' },
    original: { status_race: 'Скоро', dates: '29.09.2026' },
  },
];

describe('Rally Pack retention', () => {
  it('lists every saved race and filters by name, stage, and date', () => {
    expect(filterSavedRaces(packages, '')).toEqual(packages);
    expect(filterSavedRaces(packages, 'КУБОК')).toEqual([packages[1]]);
    expect(filterSavedRaces(packages, '27.09')).toEqual([packages[0]]);
    expect(filterSavedRaces(packages, 'not found')).toEqual([]);
  });

  it('identifies completed packages without selecting upcoming races', () => {
    expect(completedRallyPacks(packages, now)).toEqual([packages[0]]);
  });

  it('removes local map, terrain, package, favorites, and only unshared cached assets', async () => {
    const deps = {
      packages,
      removeOfflineMap: vi.fn().mockResolvedValue(),
      removeTerrain: vi.fn().mockResolvedValue(),
      deletePackage: vi.fn().mockResolvedValue(),
      removeFavorites: vi.fn(),
      deleteCachedAsset: vi.fn().mockResolvedValue(),
    };
    await deleteStoredRallyPack(packages[0], deps);
    expect(deps.removeOfflineMap).toHaveBeenCalledWith(packages[0]);
    expect(deps.removeTerrain).toHaveBeenCalledWith(packages[0]);
    expect(deps.deleteCachedAsset).toHaveBeenCalledOnce();
    expect(deps.deleteCachedAsset).toHaveBeenCalledWith('old-map.jpg');
    expect(deps.deletePackage).toHaveBeenCalledWith('race-1');
    expect(deps.removeFavorites).toHaveBeenCalledWith('race-1');
  });

  it('purges only completed packages when cleanup is enabled by its caller', async () => {
    const remove = vi.fn().mockResolvedValue();
    const deleted = await deleteCompletedRallyPacks(packages, now, remove);
    expect(deleted).toEqual([packages[0]]);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(packages[0]);
  });
});
