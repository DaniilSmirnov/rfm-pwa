import { describe, expect, it, vi } from 'vitest';
import {
  installRouteDirectionPatterns,
  ROUTE_DIRECTION_INTERVAL,
  ROUTE_DIRECTION_PATTERN_ID,
  routeKilometreMarkers,
} from '../../src/map/route-direction.js';

describe('stage route direction markers', () => {
  it('places markers every two kilometres along a stage route', () => {
    const markers = routeKilometreMarkers({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0, 0.03],
      ],
    });

    expect(ROUTE_DIRECTION_INTERVAL).toBe(2000);
    expect(markers.map(marker => marker.distance)).toEqual([2000]);
    expect(markers.every(marker => marker.rotation === 0)).toBe(true);
  });

  it('renders sharp white arrowheads over the route line', () => {
    const map = {
      addImage: vi.fn(),
      addLayer: vi.fn(),
      getLayer: vi.fn(() => null),
    };

    expect(installRouteDirectionPatterns(map)).toEqual([
      'rfm-lines-direction',
      'rfm-yandex-lines-direction',
    ]);
    expect(map.addImage).toHaveBeenCalledWith(
      ROUTE_DIRECTION_PATTERN_ID,
      expect.objectContaining({
        width: 64,
        height: 24,
        data: expect.any(Uint8Array),
      }),
      { pixelRatio: 1 },
    );

    const image = map.addImage.mock.calls[0][1];
    const pixel = (x, y) =>
      Array.from(image.data.slice((y * image.width + x) * 4, (y * image.width + x + 1) * 4));

    expect(pixel(10, 12)).toEqual([255, 255, 255, 255]);
    expect(pixel(40, 12)).toEqual([255, 255, 255, 255]);
    expect(pixel(58, 11)).toEqual([255, 255, 255, 255]);
    expect(pixel(58, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(60, 12)).toEqual([0, 0, 0, 0]);

    expect(map.addLayer.mock.calls[0][0].paint['line-pattern']).toBe(ROUTE_DIRECTION_PATTERN_ID);
    expect(map.addLayer.mock.calls[0][0].paint['line-width']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      5,
      3,
      12,
      6,
      17,
      9,
    ]);
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

    expect(markers.map(marker => marker.distance)).toEqual([2000]);
  });
});
