// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import MapView from '../../src/views/MapView.jsx';
import { getCrewSubscriptions } from '../../src/db.js';

vi.mock('../../src/db.js', () => ({
  getCrewSubscriptions: vi.fn().mockResolvedValue([]),
}));

afterEach(cleanup);

describe('MapView enhancements', () => {
  it('keeps separate map tools and favorites panels accessible', () => {
    const app = {
      currentPackage: { id: 'race-1', name: 'Rally' },
      packages: [{ id: 'race-1', name: 'Rally' }],
      favorites: [],
      mapSubtitle: '',
      mapUi: { disabled: false, button: 'Скачать офлайн-карту', status: 'Не скачана' },
      terrainUi: { disabled: false, button: 'Скачать рельеф', status: 'Не скачан' },
      carPoint: null,
      geoStatus: '',
      geoClass: '',
      requestLocation: vi.fn(),
      downloadMap: vi.fn(),
      deleteMap: vi.fn(),
      downloadTerrainForRace: vi.fn(),
      deleteTerrain: vi.fn(),
      saveCar: vi.fn(),
      exportGpx: vi.fn(),
      exportGeoJson: vi.fn(),
      selectedPoint: null,
      showPoint: vi.fn(),
    };
    render(
      <MapView
        app={app}
        pointsContent={<span>Точки</span>}
        favoritesContent={<span>Избранное</span>}
        mapContent={<span>Карта</span>}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Инструменты карты' });
    trigger.focus();
    fireEvent.click(trigger);
    const drawer = document.getElementById('mapToolsDrawer');
    expect(drawer.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(within(drawer).getByText('ИНСТРУМЕНТЫ КАРТЫ')).toBeTruthy();

    fireEvent.click(trigger);
    expect(drawer.hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(drawer.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Скачать офлайн-карту' }));
    expect(app.downloadMap).toHaveBeenCalledOnce();

    const favoritesTrigger = screen.getByRole('button', { name: 'Избранное' });
    fireEvent.click(favoritesTrigger);
    const favoritesDrawer = document.getElementById('mapFavoritesDrawer');
    expect(favoritesDrawer.hidden).toBe(false);
    expect(favoritesTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(drawer.hidden).toBe(true);
    expect(within(favoritesDrawer).getByText('ИЗБРАННЫЕ ТОЧКИ')).toBeTruthy();
    expect(within(favoritesDrawer).getByText('Пока ничего нет')).toBeTruthy();

    const carTrigger = screen.getByRole('button', { name: 'Моя машина' });
    fireEvent.click(carTrigger);
    const carDrawer = document.getElementById('mapCarDrawer');
    expect(carDrawer.hidden).toBe(false);
    expect(carTrigger.getAttribute('aria-expanded')).toBe('true');
    expect(favoritesDrawer.hidden).toBe(true);
    expect(within(carDrawer).getByText('ГДЕ МАШИНА?')).toBeTruthy();

    fireEvent.click(trigger);
    expect(drawer.hidden).toBe(false);
    expect(favoritesDrawer.hidden).toBe(true);
    expect(carDrawer.hidden).toBe(true);

    fireEvent.pointerDown(document.body);
    expect(drawer.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(drawer.hidden).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(drawer.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('renders live stage and source-backed point details without redundant tool sections', () => {
    const point = { lat: 60, lon: 35, name: 'Зрительская зона' };
    const app = {
      currentPackage: {
        id: 'race-1',
        name: 'Rally',
        mapSubtitle: 'Подпись',
        original: {
          schedule: [
            { location: 'СУ 1', date: '29.09.2026', events: [{ text: 'Дорога закрыта' }] },
            { location: 'СУ 2', date: '29.09.2026', events: [{ text: 'СУ идёт' }] },
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
      packages: [
        { id: 'race-1', name: 'Rally' },
        { id: 8, name: 'Пермь' },
      ],
      selectPackage: vi.fn(),
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
    expect(within(screen.getByLabelText('Активный спецучасток')).getByText('LIVE')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Инструменты карты' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Гонка на карте' }), {
      target: { value: '8' },
    });
    expect(app.selectPackage).toHaveBeenCalledWith(8);
    expect(
      screen.getByRole('button', { name: 'Инструменты карты' }).getAttribute('aria-controls'),
    ).toBe('mapToolsDrawer');
    expect(screen.getByRole('button', { name: 'Показать где я' }).getAttribute('id')).toBe(
      'locateBtn',
    );
    expect(document.getElementById('mapToolsDrawer').hidden).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Инструменты карты' }));
    expect(document.querySelector('.map-point-summary').textContent).toContain('4.8 / 5');
    expect(document.querySelector('.point-actions-copy').textContent).toContain('700 м');
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBe('pointName');
    expect(document.querySelector('.map-point-sheet-handle #pointName').textContent).toBe(
      'Зрительская зона',
    );
    const compactHandle = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Развернуть карточку точки',
    });
    expect(compactHandle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(compactHandle);
    expect(
      within(screen.getByRole('dialog'))
        .getByRole('button', { name: 'Свернуть карточку точки' })
        .getAttribute('aria-controls'),
    ).toBe('mapPointDetails');
    expect(screen.getByText('у трассы')).toBeTruthy();
    expect(within(document.getElementById('mapPointDetails')).getByText('700 м')).toBeTruthy();
    expect(screen.getByText('Вид на прыжок')).toBeTruthy();
    expect(screen.getByText('Оценка точки: 4.8 / 5')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Фото: Зрительская зона' }).getAttribute('src')).toBe(
      'https://example.com/photo.jpg',
    );
    expect(screen.queryByText('БЕЗОПАСНОСТЬ И ОФЛАЙН')).toBeNull();
    expect(screen.queryByText('СТАТУСЫ СПЕЦУЧАСТКОВ')).toBeNull();
    expect(screen.queryByText('ГДЕ СМОТРЕТЬ?')).toBeNull();

    const pointActions = screen.getByRole('dialog');
    const navButtons = within(pointActions)
      .getAllByRole('button')
      .map(button => button.textContent.trim());
    expect(navButtons.indexOf('MAPS.ME')).toBeLessThan(navButtons.indexOf('Yandex Navigator'));
    expect(navButtons.indexOf('Yandex Navigator')).toBeLessThan(navButtons.indexOf('Google Maps'));
    expect(navButtons.indexOf('Google Maps')).toBeLessThan(navButtons.indexOf('Поделиться'));

    const photoLink = pointActions.querySelector('.map-point-sheet-photo-link');
    fireEvent.touchStart(photoLink, { touches: [{ clientY: 140 }] });
    fireEvent.touchEnd(photoLink, { changedTouches: [{ clientY: 260 }] });
    expect(document.getElementById('mapPointDetails').getAttribute('aria-hidden')).toBe('false');

    // Gestures must work from the whole sheet, and collapse in two steps.
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть карточку точки' }));
    expect(document.getElementById('mapPointDetails').getAttribute('aria-hidden')).toBe('true');
    const sheet = screen.getByRole('dialog');
    fireEvent.touchStart(sheet, { touches: [{ clientY: 260 }] });
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 230 }] });
    expect(document.getElementById('mapPointDetails').getAttribute('aria-hidden')).toBe('true');
    fireEvent.touchStart(sheet, { touches: [{ clientY: 260 }] });
    fireEvent.touchCancel(sheet);
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 120 }] });
    expect(document.getElementById('mapPointDetails').getAttribute('aria-hidden')).toBe('true');
    fireEvent.touchStart(sheet, { touches: [{ clientY: 260 }] });
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 140 }] });
    expect(document.getElementById('mapPointDetails').getAttribute('aria-hidden')).toBe('false');
    fireEvent.touchStart(sheet, { touches: [{ clientY: 140 }] });
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 260 }] });
    expect(document.getElementById('mapPointDetails').getAttribute('aria-hidden')).toBe('true');
    expect(app.showPoint).not.toHaveBeenCalledWith(null);
    fireEvent.touchStart(sheet, { touches: [{ clientY: 260 }] });
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 380 }] });
    expect(app.showPoint).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть карточку точки' }));
    expect(app.showPoint).toHaveBeenCalledWith(null);
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
      packages: [{ id: 'race-1', name: 'Rally' }],
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

    fireEvent.click(screen.getByRole('button', { name: 'Избранное' }));

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

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Развернуть карточку точки',
      }),
    );

    expect(await screen.findByRole('region', { name: 'Следующие экипажи на этапе' })).toBeTruthy();
    expect(
      screen.getByText(/Время старта опубликовано организатором.*ETA не рассчитывается\./),
    ).toBeTruthy();
  });
});
