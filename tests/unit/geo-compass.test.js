// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { normalizeGeolocationCoords, useGeoCompass } from '../../src/hooks/useGeoCompass.js';

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

describe('useGeoCompass', () => {
  const originalGeolocation = navigator.geolocation;

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  });

  it('turns off active geolocation on the repeated location request', () => {
    const clearWatch = vi.fn();
    const watchPosition = vi.fn(success => {
      success({
        coords: {
          latitude: 61.7,
          longitude: 30.69,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
      });
      return 42;
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    });

    const { result } = renderHook(() =>
      useGeoCompass({
        selectedPoint: null,
        setSelectedPoint: vi.fn(),
        setNavStatus: vi.fn(),
      }),
    );

    act(() => result.current.requestLocation());
    expect(result.current.geoStatus).toContain('Геопозиция включена');

    act(() => result.current.requestLocation());

    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(result.current.geoStatus).toBe('Геопозиция выключена.');
    expect(result.current.geoClass).toBe('');
  });
});
