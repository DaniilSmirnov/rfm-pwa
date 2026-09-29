// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MapView from '../../src/views/MapView.jsx';

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
    expect(screen.getByText('Закрыт')).toBeTruthy();
    expect(screen.getByText('у трассы')).toBeTruthy();
    expect(screen.getByText('700 м')).toBeTruthy();
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
});
