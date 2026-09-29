// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { pointFeatureDetails, stageMapStatuses } from '../../src/app/map-details.js';

describe('map-specific race details', () => {
  it('shows the latest published stage opening or closure and leaves missing status explicit', () => {
    const pkg = {
      original: {
        schedule: [
          {
            location: 'СУ 1',
            date: '29.09.2026',
            events: [{ text: 'Дорога закрыта' }, { text: 'Дорога открыта' }],
          },
          { location: 'СУ 2', date: '29.09.2026', events: [{ text: 'Старт' }] },
        ],
      },
      geojson: { features: [] },
    };
    expect(
      stageMapStatuses(pkg).map(({ mapStatus, mapStatusKind }) => [mapStatus, mapStatusKind]),
    ).toEqual([
      ['Открыт', 'open'],
      ['Статус не опубликован', 'unknown'],
    ]);
  });

  it('returns point photo and access details only when they exist', () => {
    const pkg = {
      geojson: {
        features: [
          {
            type: 'Feature',
            properties: {
              name: 'Зрительская зона',
              photo: 'https://example.com/spot.jpg',
              parking: 'У шоссе',
              walking_distance: '1,2 км пешком',
            },
            geometry: { type: 'Point', coordinates: [35, 60] },
          },
        ],
      },
    };
    expect(pointFeatureDetails(pkg, { lat: 60, lon: 35 })).toMatchObject({
      photo: 'https://example.com/spot.jpg',
      parking: 'У шоссе',
      walking: '1,2 км пешком',
    });
    expect(pointFeatureDetails(pkg, { lat: 61, lon: 35 })).toEqual({
      feature: null,
      photo: '',
      parking: '',
      walking: '',
    });
  });

  it('rejects non-web photo schemes', () => {
    const pkg = {
      geojson: {
        features: [
          {
            properties: { photo: 'javascript:alert(1)' },
            geometry: { type: 'Point', coordinates: [1, 2] },
          },
        ],
      },
    };
    expect(pointFeatureDetails(pkg, { lat: 2, lon: 1 }).photo).toBe('');
  });
});
