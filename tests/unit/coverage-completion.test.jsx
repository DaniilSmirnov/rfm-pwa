// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../src/navigation.js', () => ({
  googleMapsDirections: vi.fn(() => 'https://maps.google.test'),
  yandexNavigatorLink: vi.fn(() => 'yandex://navigate'),
  yandexWebFallback: vi.fn(() => 'https://yandex.test'),
  mapsMeLink: vi.fn(() => 'mapsme://route'),
  mapsMeWebFallback: vi.fn(() => 'https://mapsme.test'),
  coordinateText: vi.fn(point => `${point.lat}, ${point.lon}`),
  openCustomSchemeWithFallback: vi.fn(),
  normalizePoint: vi.fn(point => point),
}));

vi.mock('../../src/app/local-points.js', () => ({
  isFavoritePoint: vi.fn(() => false),
}));

const scheduleSubscriptions = vi.hoisted(() => new Set());

vi.mock('../../src/app/preferences.js', () => ({
  subscribedStageKeys: vi.fn(() => scheduleSubscriptions),
  setStageSubscribed: vi.fn((_pkg, key, subscribed) => {
    if (subscribed) scheduleSubscriptions.add(key);
    else scheduleSubscriptions.delete(key);
  }),
  walletStageKeys: vi.fn(() => new Set()),
  setWalletStageAdded: vi.fn(),
}));

vi.mock('../../src/app/pwa.js', () => ({
  isIOSDevice: vi.fn(() => false),
}));

vi.mock('../../src/app/push-client.js', () => ({
  getPushSubscription: vi.fn(async () => ({ endpoint: 'test' })),
  setPushStatus: vi.fn(),
  scheduleRaceReminders: vi.fn(async () => ({ stored: 1 })),
  enablePushNotifications: vi.fn(),
}));

vi.mock('../../src/app/wallet-client.js', () => ({
  syncWalletStage: vi.fn(async () => ({ updated: false })),
}));

import AppHeader from '../../src/components/AppHeader.jsx';
import CatalogList from '../../src/components/CatalogList.jsx';
import CompassReadout from '../../src/components/CompassReadout.jsx';
import DownloadedRacesList from '../../src/components/DownloadedRacesList.jsx';
import FallbackMap from '../../src/components/FallbackMap.jsx';
import PointList from '../../src/components/PointList.jsx';
import ScheduleList from '../../src/components/ScheduleList.jsx';
import ScreenHeader, { useEdgeSwipeBack } from '../../src/components/ScreenHeader.jsx';
import TodayLeaders from '../../src/components/TodayLeaders.jsx';

afterEach(() => {
  cleanup();
  scheduleSubscriptions.clear();
  vi.clearAllMocks();
});

describe('unit coverage for presentational components', () => {
  it('renders the header with and without a selected race', () => {
    const onSelect = vi.fn();
    const onLogo = vi.fn();
    const { rerender } = render(<AppHeader onLogoClick={onLogo} onSelectRally={onSelect} />);
    fireEvent.click(document.getElementById('headerLogo'));
    expect(onLogo).toHaveBeenCalledOnce();
    rerender(
      <AppHeader
        onLogoClick={onLogo}
        onSelectRally={onSelect}
        currentPackage={{ id: 1, name: 'Sortavala', summary: { dates: '26–27 сентября' } }}
        packages={[
          { id: 1, name: 'Sortavala', summary: { dates: '26–27 сентября' } },
          { id: 2, raceId: 2, name: 'Гонка 2' },
        ]}
      />,
    );
    expect(screen.getAllByText('Sortavala').length).toBeGreaterThan(0);
    const rallySelect = screen.getByRole('combobox', { name: 'Текущая гонка' });
    fireEvent.click(rallySelect);
    const secondRace = screen.getByText('Гонка 2');
    expect(secondRace).toBeTruthy();
    fireEvent.click(secondRace);
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('covers catalog empty, filtered and downloadable states', () => {
    const downloadRace = vi.fn();
    const app = {
      visibleCatalog: [],
      catalogQuery: '',
      downloadedIds: new Set(),
      raceProgress: {},
      downloadRace,
    };
    const { rerender } = render(<CatalogList app={app} />);
    expect(screen.getByText('Нет гонок в пределах недели. Используй поиск.')).toBeTruthy();
    rerender(<CatalogList app={{ ...app, catalogQuery: 'x' }} />);
    expect(screen.getByText('Ничего не найдено.')).toBeTruthy();
    rerender(
      <CatalogList
        app={{
          ...app,
          visibleCatalog: [
            {
              id: 1,
              status_race: 'Скоро',
              stage_race: 'Этап 1',
              image: null,
              city_race: 'Карелия',
            },
            { id: 2, date_race: '26.09.2026', name: 'Ралли 2', city_race_details: 'Сортавала' },
          ],
          downloadedIds: new Set([1]),
          raceProgress: { 2: 'Скачиваю…' },
        }}
      />,
    );
    expect(screen.getByText('Обновить Rally Pack')).toBeTruthy();
    expect(screen.getByText('Скачиваю…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Обновить Rally Pack' }));
    expect(downloadRace).toHaveBeenCalledWith(1);
  });

  it('renders compass status for missing and valid location', () => {
    const point = { lat: 61.7, lon: 30.69, name: 'Точка' };
    const { rerender } = render(<CompassReadout />);
    expect(screen.getByText('Сначала выбери точку.')).toBeTruthy();
    rerender(<CompassReadout point={point} />);
    expect(screen.getByText('Нужна геопозиция для расчёта направления.')).toBeTruthy();
    rerender(<CompassReadout point={point} userPos={{ latitude: 61.71, longitude: 30.7 }} />);
    expect(screen.getByText('Компас включён.')).toBeTruthy();
    expect(document.getElementById('compassDisplay')).toBeTruthy();
    expect(screen.getByText(/Азимут/)).toBeTruthy();
  });

  it('renders fallback map geometry, points, user position and keyboard activation', () => {
    const onPointClick = vi.fn();
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          properties: { name: 'Маршрут', color: '#f00' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [30.68, 61.69],
              [30.7, 61.72],
            ],
          },
        },
        {
          properties: { title: 'Зона' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [30.68, 61.69],
                [30.7, 61.69],
                [30.7, 61.72],
                [30.68, 61.69],
              ],
            ],
          },
        },
        {
          properties: { kind: 'yandex-point' },
          geometry: { type: 'Point', coordinates: [30.69, 61.7] },
        },
        { properties: {}, geometry: { type: 'Point', coordinates: [30.695, 61.705] } },
      ],
    };
    const { rerender } = render(
      <FallbackMap
        geojson={geojson}
        userPos={{ longitude: 30.69, latitude: 61.7 }}
        onPointClick={onPointClick}
      />,
    );
    expect(screen.getByRole('img', { name: 'Офлайн-карта ралли' })).toBeTruthy();
    const points = screen.getAllByRole('button');
    fireEvent.click(points[0]);
    fireEvent.keyDown(points[1], { key: 'Enter' });
    fireEvent.keyDown(points[1], { key: ' ' });
    expect(onPointClick).toHaveBeenCalledTimes(3);
    rerender(<FallbackMap geojson={{ features: [] }} />);
    expect(screen.getByText(/не найдено геометрии/i)).toBeTruthy();
  });

  it('renders point navigation actions and empty states', async () => {
    const app = {
      currentPackage: null,
      toggleFavorite: vi.fn(),
      sharePoint: vi.fn(),
      showPoint: vi.fn(),
    };
    const { rerender } = render(<PointList app={app} />);
    expect(containerText()).toBe('');
    rerender(<PointList app={{ ...app, currentPackage: { id: 1, geojson: { features: [] } } }} />);
    expect(screen.getByText('Точек с координатами нет.')).toBeTruthy();
    rerender(
      <PointList
        app={{
          ...app,
          currentPackage: {
            id: 1,
            geojson: {
              features: [
                {
                  properties: { name: 'Точка' },
                  geometry: { type: 'Point', coordinates: [30.69, 61.7] },
                },
              ],
            },
          },
        }}
      />,
    );
    const row = screen.getByText('Точка').closest('.point-row');
    fireEvent.click(row);
    expect(app.showPoint).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /В избранное/ }));
    fireEvent.click(screen.getByRole('button', { name: 'MAPS.ME' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yandex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Google Maps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    fireEvent.click(screen.getByRole('button', { name: /Копировать/ }));
    await waitFor(() => expect(app.toggleFavorite).toHaveBeenCalled());
    expect(app.sharePoint).toHaveBeenCalled();
  });

  it('renders downloaded races empty, filtered and action states', () => {
    const app = {
      packages: [],
      packageQuery: '',
      raceProgress: {},
      downloadRace: vi.fn(),
      deleteRace: vi.fn(),
    };
    const onOpenRace = vi.fn();
    const { rerender } = render(<DownloadedRacesList app={app} onOpenRace={onOpenRace} />);
    expect(screen.getByText('Скачанных гонок пока нет.')).toBeTruthy();
    rerender(
      <DownloadedRacesList
        app={{ ...app, packages: [{ id: 1, name: 'Rally' }], packageQuery: 'missing' }}
      />,
    );
    expect(screen.getByText('По этому запросу гонок не найдено.')).toBeTruthy();
    rerender(
      <DownloadedRacesList
        app={{
          ...app,
          packages: [
            { id: 1, name: 'Rally', summary: { dates: '26.09.2026' } },
            { id: 2, original: { id: 'bad' }, name: 'No id' },
            { id: 3, name: 'Rally 3' },
          ],
          raceProgress: { 1: 'Обновляю…' },
        }}
        onOpenRace={onOpenRace}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rally' }));
    const updateButton = screen.getByRole('button', { name: 'Обновляю…' });
    expect(updateButton.disabled).toBe(false);
    fireEvent.click(updateButton);
    fireEvent.click(screen.getAllByRole('button', { name: 'Обновить' }).at(-1));
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]);
    expect(onOpenRace).toHaveBeenCalledWith(1);
    expect(app.deleteRace).toHaveBeenCalledWith(1);
  });

  it('renders schedule branches and invokes stage selection', async () => {
    const onStageSelect = vi.fn();
    const pkg = { id: 1, original: {} };
    const { rerender } = render(<ScheduleList pkg={pkg} schedule={[]} />);
    expect(screen.getByText('Расписание отсутствует.')).toBeTruthy();
    rerender(
      <ScheduleList
        pkg={pkg}
        selectedStageKey="су-1"
        onStageSelect={onStageSelect}
        schedule={[
          {
            date: '26.09.2026',
            location: 'СУ 1 Сортавала',
            coordinates: '61,30',
            events: [{ time: '10:00' }],
          },
          { location: 'Торжественное открытие', events: [{ text: 'Открытие' }] },
        ]}
      />,
    );
    const stage = screen.getByRole('button', { name: /Открыть/ });
    fireEvent.click(stage);
    fireEvent.keyDown(stage, { key: 'Enter' });
    fireEvent.keyDown(stage, { key: ' ' });
    expect(onStageSelect).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: /Включить уведомления/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Выключить уведомления/ })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Выключить уведомления' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Включить уведомления/ })).toBeTruthy(),
    );
  });

  it('covers edge-swipe back and header button', () => {
    function Harness({ enabled = true }) {
      const onBack = React.useRef(vi.fn()).current;
      useEdgeSwipeBack(onBack, enabled);
      return <ScreenHeader title="Экран" onBack={onBack} />;
    }
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    fireEvent.touchStart(document, { changedTouches: [{ clientX: 20, clientY: 100 }] });
    fireEvent.touchEnd(document, { changedTouches: [{ clientX: 90, clientY: 120 }] });
    fireEvent.touchStart(document, { changedTouches: [{ clientX: 20, clientY: 100 }] });
    fireEvent.touchEnd(document, { changedTouches: [{ clientX: 90, clientY: 200 }] });
    rerender(<Harness enabled={false} />);
    expect(screen.getByRole('heading', { name: 'Экран' })).toBeTruthy();
  });

  it('renders leaders with and without results and responds to refresh events', () => {
    const onResults = vi.fn();
    const pkg = { id: 1, crewResults: { eventResults: [] } };
    const { rerender } = render(<TodayLeaders pkg={pkg} onResults={onResults} />);
    expect(screen.getByText(/Результаты пока/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Все результаты' }));
    expect(onResults).toHaveBeenCalledOnce();
    const result = {
      crew: { number: 7, pilot: { firstName: 'Иван', lastName: 'Иванов' }, car: 'Skoda' },
      discipline: { name: 'N4' },
      time: 100,
      formattedTime: '00:10',
    };
    rerender(
      <TodayLeaders pkg={{ id: 1, crewResults: { eventResults: [{ results: [result] }] } }} />,
    );
    expect(screen.getByText(/N4 · 1 место/)).toBeTruthy();
    fireEvent(
      window,
      new CustomEvent('rfm:crew-results-updated', {
        detail: { packageId: 1, results: { eventResults: [{ results: [result] }] } },
      }),
    );
    expect(screen.getByText(/Иванов Иван/)).toBeTruthy();
  });
});

function containerText() {
  return document.body.textContent;
}
