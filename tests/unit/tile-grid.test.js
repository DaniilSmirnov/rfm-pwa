import { describe, expect, it } from 'vitest';
import { buildTilePlan, clampLat, lat2y, lon2x, tileRange } from '../../src/app/tile-grid.js';

describe('shared tile planner', () => {
  it('clamps latitude at the Web Mercator limit', () => {
    expect(clampLat(100)).toBeCloseTo(85.05112878);
    expect(clampLat(-100)).toBeCloseTo(-85.05112878);
  });

  it('keeps tile coordinates inside the world', () => {
    expect(lon2x(180, 4)).toBe(16);
    expect(lat2y(90, 4)).toBeLessThanOrEqual(0);
    expect(tileRange({ minLon: -180, maxLon: 180, minLat: -85, maxLat: 85 }, 2)).toMatchObject({
      x0: 0,
      x1: 3,
      y0: 0,
      y1: 3,
    });
  });

  it('reduces maximum zoom until the tile budget is respected', () => {
    const plan = buildTilePlan(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [30, 60],
                [30.01, 60.01],
              ],
            },
          },
        ],
      },
      { minZoom: 6, maxZoom: 14, maxTiles: 100 },
    );
    expect(plan.tiles.length).toBeLessThanOrEqual(100);
    expect(Math.max(...plan.tiles.map(tile => tile.z))).toBe(plan.maxZoom);
  });
});
