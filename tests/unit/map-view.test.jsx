// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import MapView from '../../src/views/MapView.jsx';
import { getCrewSubscriptions } from '../../src/db.js';

vi.mock('../../src/db.js', () => ({
  getCrewSubscriptions: vi.fn().mockResolvedValue([]),
}));

describe('MapView enhancements', () => {
  it('renders stage status, source-backed point details, safety and offline guidance', () => {
    const point = { lat: 60, lon: 35, name: 'Зрительская зона' };
    const app = {
      currentPackage: {
        id: 'race-1',
        name: 'Rally',
        mapSubtitle: 'Подпись',
        original: {
          schedule: [
            { location: 'СУ 1', date: '29.09.2026', events: [{ text: 'Дорога закрыта' }] },
          ],
        },
        geojson: {
          features: [
            {
              properties: {
                name: point.name,
                photo: 'https://example.com/photo.jpg',
                parking: 'у трассы',
                walking: '700 м',
                description: 'Вид на прыжок',
                rating: '4.8 / 5',
              },
              geometry: { type: 'Point', coordinates: [35, 60] },
            },
          ],
        },
      },
      mapUi: { disabled: false, button: 'Скачать офлайн-карту', status: 'Не скачана' },
      downloadMap: vi.fn(),
      deleteOfflineMap: vi.fn(),
      terrainUi: { disabled: false, button: 'Скачать рельеф', status: 'Не скачан' },
      downloadTerrainForRace: vi.fn(),
      deleteTerrain: vi.fn(),
      deleteMap: vi.fn(),
      selectedPoint: point,
      favorites: [],
      mapSubtitle: 'Пакет доступен офлайн',
      navStatus: '',
      geoStatus: '',
      geoClass: '',
      setNavStatus: vi.fn(),
      setMapDiag: vi.fn(),
      showPoint: vi.fn(),
      toggleFavorite: vi.fn(),
      sharePoint: vi.fn(),
      saveCar: vi.fn(),
      removeCar: vi.fn(),
      requestLocation: vi.fn(),
      exportGpx: vi.fn(),
      exportGeoJson: vi.fn(),
      enableCompass: vi.fn(),
      compassEnabled: false,
      userPos: null,
      carPoint: null,
    };
    render(
      <MapView
        app={app}
        selectedRoute={null}
        pointElevation="Высота: 50 м"
        pointStageDistance={{
          stage: { name: 'СУ 1' },
          distance: { fromStart: 1000, toFinish: 3000 },
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Инструменты карты' })).toBeTruthy();
    expect(document.getElementById('mapToolsDrawer').hidden).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Инструменты карты' }));
    fireEvent.click(screen.getByRole('button', { name: 'Показать детали' }));
    expect(screen.getByText('Закрыт')).toBeTruthy();
    expect(screen.getByText('у трассы')).toBeTruthy();
    expect(screen.getByText('700 м')).toBeTruthy();
    expect(screen.getByText('Вид на прыжок')).toBeTruthy();
    expect(screen.getByText('Оценка точки: 4.8 / 5')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Фото: Зрительская зона' }).getAttribute('src')).toBe(
      'https://example.com/photo.jpg',
    );
    expect(screen.getByText(/Оставайся в разрешённых зрительских зонах/)).toBeTruthy();

    const pointActions = screen.getByRole('complementary');
    const navButtons = within(pointActions)
      .getAllByRole('button')
      .map(button => button.textContent.trim());
    expect(navButtons.indexOf('MAPS.ME')).toBeLessThan(navButtons.indexOf('Yandex Navigator'));
    expect(navButtons.indexOf('Yandex Navigator')).toBeLessThan(navButtons.indexOf('Google Maps'));
    expect(navButtons.indexOf('Google Maps')).toBeLessThan(navButtons.indexOf('Поделиться'));
  });

  it('shows followed crews on Map with overall place, gap and latest stage context', async () => {
    getCrewSubscriptions.mockResolvedValueOnce([
      { key: 'race-1:crew-8', raceId: 'race-1', crewId: 'crew-8', number: 8, name: 'Экипаж 8' },
    ]);
    const app = {
      currentPackage: {
        id: 'race-1',
        raceId: 'race-1',
        name: 'Rally',
        crewResults: {
          eventResults: [
            {
              specialStage: { name: 'СУ 1' },
              results: [
                { crew: { id: 'crew-4', number: 4 }, time: 100000 },
                {
                  crew: {
                    id: 'crew-8',
                    number: 8,
                    pilot: { lastName: 'Иванов', firstName: 'Иван' },
                  },
                  time: 110000,
                  formattedTime: '00:00:11:0',
                },
              ],
            },
          ],
        },
        original: {},
      },
      mapSubtitle: '',
      favorites: [],
      mapUi: { disabled: true, button: '', status: '' },
      terrainUi: { disabled: true, button: '', status: '' },
      carPoint: null,
      requestLocation: vi.fn(),
      exportGpx: vi.fn(),
      exportGeoJson: vi.fn(),
    };
    render(<MapView app={app} mapContent={<span>Карта</span>} />);

    fireEvent.click(screen.getByRole('button', { name: 'Инструменты карты' }));

    const followed = await screen.findByRole('region', { name: 'Избранные экипажи' });
    expect(followed.textContent).toContain('2. № 8 · Иванов Иван');
    expect(followed.textContent).toContain('отставание 00:00:10:0');
    expect(followed.textContent).toContain('СУ 1: 00:00:11:0');
  });

  it('shows published crew start times for a selected spectator point and labels them as starts', async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const date = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(tomorrow);
    const app = {
      currentPackage: {
        id: 'race-1',
        original: {
          schedule: [
            {
              location: 'СУ 1',
              date,
              events: [{ time: '12:00', text: 'Старт экипажа', crewNumber: 12 }],
            },
          ],
        },
      },
      selectedPoint: { lat: 60, lon: 35, name: 'Точка' },
      mapSubtitle: '',
      favorites: [],
      mapUi: { disabled: true, button: '', status: '' },
      terrainUi: { disabled: true, button: '', status: '' },
      carPoint: null,
      requestLocation: vi.fn(),
      exportGpx: vi.fn(),
      exportGeoJson: vi.fn(),
    };
    render(
      <MapView
        app={app}
        pointStageDistance={{
          stage: { name: 'СУ 1' },
          distance: { fromStart: 500, toFinish: 500 },
        }}
        mapContent={<span>Карта</span>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Показать детали' }));

    expect(await screen.findByRole('region', { name: 'Следующие экипажи на этапе' })).toBeTruthy();
    expect(
      screen.getByText(/Время старта опубликовано организатором.*ETA не рассчитывается\./),
    ).toBeTruthy();
  });
});
