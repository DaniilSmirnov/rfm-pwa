import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/app/elevation.js', () => ({ elevationAt: vi.fn(), elevationProfile: vi.fn() }));
import { elevationAt, elevationProfile } from '../../src/app/elevation.js';
import { pointElevationText, routeElevationData } from '../../src/app/elevation-ui.js';

beforeEach(() => vi.clearAllMocks());

describe('elevation view models for React', () => {
  it('explains that point elevation needs an offline terrain package', async () => {
    await expect(pointElevationText(null, { lat: 61, lon: 30 })).resolves.toContain(
      'рельеф не скачан',
    );
    expect(elevationAt).not.toHaveBeenCalled();
  });

  it('returns a rounded sampled elevation for a selected point', async () => {
    elevationAt.mockResolvedValue(154.6);
    await expect(pointElevationText({ ready: true }, { lat: 61, lon: 30 })).resolves.toBe(
      'Высота: 155 м',
    );
  });

  it('returns an explanatory state when profile data is unavailable', async () => {
    await expect(
      routeElevationData(null, { name: 'СУ 1', geometry: { type: 'LineString', coordinates: [] } }),
    ).resolves.toEqual({
      state: 'unavailable',
      message: 'Скачай рельеф, чтобы построить профиль высот.',
    });
  });

  it('returns profile metrics for the React elevation view', async () => {
    const profile = { distance: 12345, min: 90, max: 240, gain: 180, loss: 130, points: [{}, {}] };
    elevationProfile.mockResolvedValue(profile);
    await expect(
      routeElevationData(
        { ready: true },
        {
          name: 'СУ 2',
          geometry: {
            type: 'LineString',
            coordinates: [
              [30, 60],
              [30.1, 60.1],
            ],
          },
        },
      ),
    ).resolves.toEqual({ state: 'ready', profile });
  });

  it('returns an error message as text instead of inserting markup', async () => {
    elevationProfile.mockRejectedValue(new Error('<img src=x onerror=alert(1)>'));
    const result = await routeElevationData(
      { ready: true },
      { name: 'СУ 3', geometry: { type: 'LineString', coordinates: [] } },
    );
    expect(result).toEqual({
      state: 'error',
      message: 'Не удалось построить профиль: <img src=x onerror=alert(1)>',
    });
  });
});
