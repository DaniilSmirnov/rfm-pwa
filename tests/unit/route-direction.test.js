import { describe, expect, it } from 'vitest';
import {
  ROUTE_DIRECTION_INTERVAL,
  routeKilometreMarkers,
} from '../../src/map/route-direction.js';

describe('stage route direction markers', () => {
  it('places frequent markers along a stage route', () => {
    const markers = routeKilometreMarkers({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0, 0.03],
      ],
    });

    expect(ROUTE_DIRECTION_INTERVAL).toBe(750);
    expect(markers.map(marker => marker.distance)).toEqual([750, 1500, 2250, 3000]);
    expect(markers.every(marker => marker.rotation === 0)).toBe(true);
  });

  it('supports multiple route segments without resetting distance', () => {
    const markers = routeKilometreMarkers({
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [0, 0.01],
        ],
        [
          [0, 0.01],
          [0, 0.02],
        ],
      ],
    });

    expect(markers.map(marker => marker.distance)).toEqual([750, 1500]);
  });
});
