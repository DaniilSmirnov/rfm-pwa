// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  pointFeatureDetails,
  scheduledStageCrews,
  stagePointResults,
  stageMapStatuses,
} from '../../src/views/MapView/logic/map-details.js';

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

  it('normalizes explicit live, completed and changed stage states', () => {
    const pkg = {
      original: {
        schedule: [
          { location: 'СУ 1', events: [{ text: 'LIVE', state: 'live' }] },
          { location: 'СУ 2', events: [{ text: 'Этап завершён' }] },
          { location: 'СУ 3', events: [{ text: 'Время старта перенесено' }] },
        ],
      },
    };
    expect(
      stageMapStatuses(pkg).map(({ mapStatus, mapStatusKind }) => [mapStatus, mapStatusKind]),
    ).toEqual([
      ['LIVE', 'live'],
      ['Завершён', 'completed'],
      ['Изменён', 'changed'],
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
    expect(pointFeatureDetails(pkg, { lat: 61, lon: 35 })).toMatchObject({
      feature: null,
      photo: '',
      parking: '',
      walking: '',
      description: '',
      rating: '',
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

  it('lists future crew start times for the selected stage without inventing point ETAs', () => {
    const pkg = {
      summary: { dates: '2026' },
      original: {
        schedule: [
          {
            location: 'СУ 1',
            date: '30.09.2026',
            events: [
              { time: '11:00', text: 'Старт экипажа', crewNumber: 12 },
              { time: '11:20', text: 'Старт экипажа', number: 14 },
            ],
          },
          {
            location: 'СУ 2',
            date: '30.09.2026',
            events: [{ time: '11:05', text: 'Старт экипажа', crewNumber: 99 }],
          },
        ],
      },
    };
    const crews = scheduledStageCrews(pkg, 'СУ 1', new Date('2026-09-30T07:00:00.000Z'));
    expect(crews.map(row => [row.number, row.time])).toEqual([
      ['12', '11:00'],
      ['14', '11:20'],
    ]);
  });

  it('matches ASMG stage names with an appended location to the schedule stage', () => {
    const pkg = {
      original: {
        schedule: [
          {
            location: 'СУ 1 · Лесной',
            date: '30.09.2026',
            starts: [{ time: '11:00', crewNumber: 12 }],
          },
        ],
      },
      crewResults: {
        eventResults: [
          {
            specialStage: { name: 'СУ 1 · Лесной', distance: 7 },
            results: [
              {
                time: 255100,
                formattedTime: '00:04:15:1',
                crew: { number: 12, pilot: { firstName: 'Клим', lastName: 'Гаврилов' } },
              },
            ],
          },
        ],
      },
    };
    const start = new Date('2026-09-30T08:00:00.000Z');
    const crews = scheduledStageCrews(pkg, 'СУ 1', start, 1000);
    expect(crews).toHaveLength(1);
    expect(crews[0].eta).toBeInstanceOf(Date);
    expect(stagePointResults(pkg, 'СУ 1')).toMatchObject({
      completedCount: 1,
      bestResult: { formattedTime: '00:04:15:1' },
    });
  });
});
