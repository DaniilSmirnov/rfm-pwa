import { describe, expect, it } from 'vitest';
import { normalizeGeolocationCoords } from '../../src/hooks/useGeoCompass.js';

describe('normalizeGeolocationCoords', () => {
  it('copies prototype-backed mobile GeolocationCoordinates into a plain object', () => {
    const prototype = {};
    Object.defineProperties(prototype, {
      latitude: { get: () => 61.7 },
      longitude: { get: () => 30.69 },
      accuracy: { get: () => 5 },
      altitude: { get: () => null },
      altitudeAccuracy: { get: () => null },
      heading: { get: () => null },
      speed: { get: () => null },
    });
    const coords = Object.create(prototype);

    expect({ ...coords }).toEqual({});
    expect(normalizeGeolocationCoords(coords, { __center: true })).toEqual({
      latitude: 61.7,
      longitude: 30.69,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      __center: true,
    });
  });
});
