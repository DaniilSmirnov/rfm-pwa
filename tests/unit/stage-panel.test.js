import { describe, expect, it } from 'vitest';
import {
  elevationGridStep,
  elevationGridLevels,
  profileChartGeometry,
} from '../../src/app/elevation-chart.js';

describe('React elevation chart geometry', () => {
  it('uses a fixed 250 metre grid for stage elevation spans', () => {
    expect(elevationGridStep(83, 217)).toBe(250);
    expect(elevationGridLevels(83, 217)).toEqual([0, 250]);
    expect(elevationGridLevels(610, 1170)).toEqual([500, 750, 1000, 1250]);
  });

  it('returns coordinates and labels for React SVG rendering', () => {
    const geometry = profileChartGeometry({
      min: 83,
      max: 117,
      distance: 2500,
      points: [
        { distance: 0, elevation: 90 },
        { distance: 1250, elevation: 115 },
        { distance: 2500, elevation: 100 },
      ],
    });
    expect(geometry.levels.map(level => level.value)).toEqual([0, 250]);
    expect(geometry.points).toHaveLength(3);
    expect(geometry.points[0].x).toBe(58);
    expect(geometry.distanceLabel).toBe('2.5 км');
  });
});
