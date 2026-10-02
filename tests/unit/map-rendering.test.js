// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { applyTerrainMode, isPositionWithinMapBounds } from '../../src/map.js';

describe('map rendering safeguards', () => {
  it('switches terrain in place without replacing the MapLibre instance', () => {
    const map = {
      setTerrain: vi.fn(),
      getLayer: vi.fn(() => ({ id: 'terrain-hillshade' })),
      setLayoutProperty: vi.fn(),
      getBearing: vi.fn(() => 12),
      easeTo: vi.fn(),
    };

    expect(applyTerrainMode(map, '3d')).toBe(true);
    expect(map.setTerrain).toHaveBeenCalledWith({
      source: 'offline-terrain-3d',
      exaggeration: 1.35,
    });
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'terrain-hillshade',
      'visibility',
      'none',
    );
    expect(map.easeTo).toHaveBeenCalledWith({ bearing: 12, pitch: 70, duration: 450 });

    expect(applyTerrainMode(map, 'hillshade')).toBe(true);
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith(
      'terrain-hillshade',
      'visibility',
      'visible',
    );
    expect(map.easeTo).toHaveBeenLastCalledWith({ bearing: 0, pitch: 0, duration: 450 });
  });

  it('does not recenter the map on a GPS position outside downloaded bounds', () => {
    const map = {
      getMaxBounds: () => ({
        contains: ([longitude, latitude]) =>
          longitude >= 30.68 &&
          longitude <= 30.71 &&
          latitude >= 61.69 &&
          latitude <= 61.72,
      }),
    };

    expect(isPositionWithinMapBounds(map, 30.69, 61.7)).toBe(true);
    expect(isPositionWithinMapBounds(map, 30.8, 61.8)).toBe(false);
  });
});
