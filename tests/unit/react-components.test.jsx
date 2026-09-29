// @vitest-environment happy-dom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useRfmApp: vi.fn(),
  ensureMapLibre: vi.fn(),
  renderMap: vi.fn(),
  resizeActiveMap: vi.fn(),
  updateLiveUserPosition: vi.fn(),
  syncWalletPassesForPackage: vi.fn(),
  syncWalletStage: vi.fn(),
  routeElevationData: vi.fn(),
  pointElevationText: vi.fn(),
  getPwaInstallSnapshot: vi.fn(),
  requestPwaInstall: vi.fn(),
  subscribePwaInstall: vi.fn(),
  getPushStatus: vi.fn(),
  refreshPushUi: vi.fn(),
  enablePushNotifications: vi.fn(),
  sendTestPush: vi.fn(),
  getPushSubscription: vi.fn(),
  setPushStatus: vi.fn(),
  scheduleRaceReminders: vi.fn(),
  fetchAsmgResults: vi.fn(),
  getCrewSubscriptions: vi.fn(),
  saveCrewSubscription: vi.fn(),
  deleteCrewSubscription: vi.fn(),
  savePackage: vi.fn(),
  requestCrewResultsBackgroundRefresh: vi.fn(),
  bootSnapshot: vi.fn(),
  collectStorageDiagnostics: vi.fn(),
  markBoot: vi.fn(),
  hasSafetyConsent: vi.fn(),
  saveSafetyConsent: vi.fn(),
}));

vi.mock('../../src/hooks/useRfmApp.js', () => ({
  useRfmApp: mocks.useRfmApp,
  ensureMapLibre: mocks.ensureMapLibre,
  formatBytes: value => `${value || 0} B`,
}));
vi.mock('../../src/map.js', () => ({
  renderMap: mocks.renderMap,
  resizeActiveMap: mocks.resizeActiveMap,
  updateLiveUserPosition: mocks.updateLiveUserPosition,
}));
vi.mock('../../src/app/wallet-client.js', () => ({
  syncWalletPassesForPackage: mocks.syncWalletPassesForPackage,
  syncWalletStage: mocks.syncWalletStage,
}));
vi.mock('../../src/app/elevation-ui.js', () => ({
  routeElevationData: mocks.routeElevationData,
  pointElevationText: mocks.pointElevationText,
}));
vi.mock('../../src/app/pwa.js', () => ({
  getPwaInstallSnapshot: mocks.getPwaInstallSnapshot,
  requestPwaInstall: mocks.requestPwaInstall,
  subscribePwaInstall: mocks.subscribePwaInstall,
  isIOSDevice: () => false,
  enablePushNotifications: mocks.enablePushNotifications,
  getPushSubscription: mocks.getPushSubscription,
  setPushStatus: mocks.setPushStatus,
}));
vi.mock('../../src/app/push-client.js', () => ({
  getPushStatus: mocks.getPushStatus,
  refreshPushUi: mocks.refreshPushUi,
  enablePushNotifications: mocks.enablePushNotifications,
  sendTestPush: mocks.sendTestPush,
  getPushSubscription: mocks.getPushSubscription,
  setPushStatus: mocks.setPushStatus,
  scheduleRaceReminders: mocks.scheduleRaceReminders,
}));
vi.mock('../../src/db.js', () => ({
  getCrewSubscriptions: mocks.getCrewSubscriptions,
  saveCrewSubscription: mocks.saveCrewSubscription,
  deleteCrewSubscription: mocks.deleteCrewSubscription,
  savePackage: mocks.savePackage,
}));
vi.mock('../../src/app/runtime.js', () => ({
  requestCrewResultsBackgroundRefresh: mocks.requestCrewResultsBackgroundRefresh,
}));
vi.mock('../../src/app/boot-diagnostics.js', () => ({
  bootSnapshot: mocks.bootSnapshot,
  collectStorageDiagnostics: mocks.collectStorageDiagnostics,
  markBoot: mocks.markBoot,
}));
vi.mock('../../src/app/safety-consent.js', () => ({
  hasSafetyConsent: mocks.hasSafetyConsent,
  saveSafetyConsent: mocks.saveSafetyConsent,
}));
vi.mock('../../src/app/crew-results.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, fetchAsmgResults: mocks.fetchAsmgResults };
});

import AppHeader from '../../src/components/AppHeader.jsx';
import AppFooter from '../../src/components/AppFooter.jsx';
import CatalogList from '../../src/components/CatalogList.jsx';
import CatalogSection from '../../src/components/CatalogSection.jsx';
import CompassReadout from '../../src/components/CompassReadout.jsx';
import CrewResults from '../../src/components/CrewResults.jsx';
import ElevationProfile from '../../src/components/ElevationProfile.jsx';
import FallbackMap from '../../src/components/FallbackMap.jsx';
import FavoritesList from '../../src/components/FavoritesList.jsx';
import MoreMenu from '../../src/components/MoreMenu.jsx';
import RacesView from '../../src/views/RacesView.jsx';
import OfflineMapActions from '../../src/components/OfflineMapActions.jsx';
import PointList from '../../src/components/PointList.jsx';
import PushSettings from '../../src/components/PushSettings.jsx';
import PwaInstallPrompt from '../../src/components/PwaInstallPrompt.jsx';
import RaceMedia from '../../src/components/RaceMedia.jsx';
import RallyMap from '../../src/components/RallyMap.jsx';
import SafetyMemo from '../../src/components/SafetyMemo.jsx';
import SavedOfflineSection from '../../src/components/SavedOfflineSection.jsx';
import SavedPackagesList from '../../src/components/SavedPackagesList.jsx';
import DownloadedRacesList from '../../src/components/DownloadedRacesList.jsx';
import ScheduleList from '../../src/components/ScheduleList.jsx';
import TodayLeaders from '../../src/components/TodayLeaders.jsx';
import AppLayout from '../../src/views/AppLayout.jsx';
import MapView from '../../src/views/MapView.jsx';
import RaceDetails from '../../src/views/RaceDetails.jsx';
import SettingsView from '../../src/views/SettingsView.jsx';
import TodayView, { nextScheduledCrew } from '../../src/views/TodayView.jsx';
import App from '../../src/views/App.jsx';
import BootDiagnostics from '../../src/modals/BootDiagnostics.jsx';
import CrewResultsModal from '../../src/modals/CrewResultsModal.jsx';
import ImageViewerModal from '../../src/modals/ImageViewerModal.jsx';
import SafetyGate from '../../src/modals/SafetyGate.jsx';

const feature = {
  type: 'Feature',
  properties: { name: 'Start' },
  geometry: { type: 'Point', coordinates: [30, 61] },
};
function raceDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays),
  );
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getUTCFullYear()}`;
}
const todayDate = raceDate();

const race = {
  id: 7,
  raceId: 7,
  name: 'Карелия',
  savedAt: '2026-09-28T09:00:00Z',
  size: 64,
  original: {
    id: 7,
    image: '/race.jpg',
    mapsimg: '/map.jpg',
    safety_leaflet: '/safety.jpg',
    list_crews: '/crews.jpg',
    results_race: '/results.jpg',
    how_it_was: '<p>Финиш</p>',
    schedule: [
      {
        date: todayDate,
        location: 'СУ 1',
        coordinates: '61, 30',
        events: [{ time: '10:00', text: 'Старт СУ 1' }],
      },
    ],
  },
  summary: {
    category: 'Ралли',
    stage: 'Кубок',
    dates: todayDate,
    city: 'Карелия',
    totalDistance: 100,
    combatKm: 60,
    days: 1,
  },
  geojson: { type: 'FeatureCollection', features: [feature] },
  assetNames: ['/extra.jpg'],
  crewResults: null,
  terrain: { ready: true, storageId: 'terrain-7' },
  pendingUpdate: { changes: [{ label: 'Маршрут' }] },
};

function appFixture(overrides = {}) {
  return {
    online: true,
    currentPackage: race,
    packages: [race],
    visiblePackages: [race],
    catalog: [],
    visibleCatalog: [],
    downloadedIds: new Set([7]),
    raceProgress: {},
    catalogStatus: 'Каталог загружен',
    catalogQuery: '',
    packageQuery: '',
    favorites: [],
    carPoint: null,
    selectedPoint: null,
    userPos: null,
    mapUi: {
      disabled: false,
      deleteHidden: false,
      button: 'Скачать карту',
      status: 'Карта готова',
    },
    terrainUi: {
      disabled: false,
      deleteHidden: false,
      button: 'Скачать рельеф',
      status: 'Рельеф готов',
    },
    mapSubtitle: 'Подложка офлайн',
    mapDiag: 'MapLibre готова',
    navStatus: '',
    geoStatus: '',
    geoClass: '',
    compassEnabled: false,
    storageStats: { count: 1, jsonBytes: 12, mapBytes: 22, mapCount: 2, persisted: true },
    autoDeleteCompletedRaces: false,
    ...Object.fromEntries(
      [
        'setCatalogQuery',
        'setPackageQuery',
        'loadCatalog',
        'clearAll',
        'importFiles',
        'downloadMap',
        'deleteMap',
        'downloadTerrainForRace',
        'deleteTerrain',
        'downloadRace',
        'deleteRace',
        'setAutoDeleteCompletedRaces',
        'showPoint',
        'toggleFavorite',
        'selectPackage',
        'saveCar',
        'removeCar',
        'enableCompass',
        'sharePoint',
        'exportGpx',
        'exportGeoJson',
        'requestLocation',
        'setNavStatus',
        'setMapDiag',
      ].map(key => [key, vi.fn()]),
    ),
    ...overrides,
  };
}

const result = {
  crew: {
    id: 'crew-1',
    number: 12,
    car: 'Lada',
    pilot: { firstName: 'Иван', lastName: 'Пилот' },
    navigator: { firstName: 'Пётр', lastName: 'Штурман' },
  },
  time: 90000,
  formattedTime: '00:01:30:0',
  discipline: { name: 'Абсолют' },
};
const crewData = {
  eventId: '55',
  tournamentTitle: 'Ралли',
  eventResults: [{ specialStage: { id: 'ss-1', name: 'СУ 1' }, results: [result] }],
};

beforeEach(() => {
  mocks.useRfmApp.mockReturnValue(appFixture());
  mocks.ensureMapLibre.mockResolvedValue();
  mocks.renderMap.mockReturnValue({});
  mocks.routeElevationData.mockResolvedValue({
    profile: {
      distance: 1200,
      min: 10,
      max: 20,
      gain: 15,
      loss: 5,
      points: [
        { distance: 0, elevation: 10 },
        { distance: 1200, elevation: 20 },
      ],
    },
  });
  mocks.pointElevationText.mockResolvedValue('Высота 20 м');
  mocks.getPwaInstallSnapshot.mockReturnValue({
    installedLaunch: false,
    promptAvailable: false,
    instructions: {
      title: 'Добавь приложение',
      text: 'На главный экран',
      action: 'Как установить',
      steps: ['Открой меню'],
    },
  });
  mocks.subscribePwaInstall.mockReturnValue(() => {});
  mocks.getPushStatus.mockReturnValue({ text: 'Уведомления выключены', className: '' });
  mocks.refreshPushUi.mockResolvedValue({
    supported: true,
    requiresInstall: false,
    active: false,
    testVisible: true,
    label: 'Включить уведомления',
  });
  mocks.enablePushNotifications.mockResolvedValue();
  mocks.getPushSubscription.mockResolvedValue({ endpoint: 'push' });
  mocks.scheduleRaceReminders.mockResolvedValue({ stored: 1 });
  mocks.fetchAsmgResults.mockResolvedValue(crewData);
  mocks.getCrewSubscriptions.mockResolvedValue([]);
  mocks.saveCrewSubscription.mockResolvedValue();
  mocks.deleteCrewSubscription.mockResolvedValue();
  mocks.savePackage.mockResolvedValue();
  mocks.bootSnapshot.mockReturnValue({
    marks: [{ name: 'start', ms: 4 }],
    meta: {
      online: true,
      displayMode: 'browser',
      navigationType: 'navigate',
      serviceWorkerControlled: false,
      domContentLoadedMs: 4,
      loadEventMs: 5,
      userAgent: 'test',
    },
    storage: null,
  });
  mocks.collectStorageDiagnostics.mockResolvedValue({});
  mocks.hasSafetyConsent.mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  document.body.classList.remove('modal-open');
});

describe('application components', () => {
  it('selects the current rally from the shared header', () => {
    const onSelectRally = vi.fn();
    render(
      <AppHeader
        online
        onLogoClick={() => {}}
        currentPackage={{ id: 7, name: 'Карелия' }}
        packages={[
          { id: 7, name: 'Карелия' },
          { id: 8, name: 'Пермь' },
        ]}
        onSelectRally={onSelectRally}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Текущая гонка' }), {
      target: { value: '8' },
    });
    expect(onSelectRally).toHaveBeenCalledWith('8');
  });
  it('provides race management and settings destinations from More', () => {
    const onRaces = vi.fn();
    const onSettings = vi.fn();
    render(<MoreMenu onRaces={onRaces} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /Гонки и Rally Pack/ }));
    fireEvent.click(screen.getByRole('button', { name: /Настройки и диагностика/ }));
    expect(onRaces).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
  });
  it('renders app chrome, catalog, and install prompt states', async () => {
    render(
      <>
        <AppHeader online={false} onLogoClick={() => {}} />
        <AppFooter />
        <CatalogSection app={appFixture()}>
          <CatalogList
            app={appFixture({ visibleCatalog: [{ id: 7, name: 'Карелия', dates: '28 сентября' }] })}
          />
        </CatalogSection>
        <PwaInstallPrompt />
      </>,
    );
    expect(screen.getByText('офлайн')).toBeTruthy();
    expect(screen.getByText(/Companion v/)).toBeTruthy();
    expect(screen.getByText('Карелия')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Найти гонку или этап' })).toBeTruthy();
    expect(screen.getByText('Добавь приложение')).toBeTruthy();
    await waitFor(() => expect(mocks.subscribePwaInstall).toHaveBeenCalled());
  });

  it('covers catalog empty and downloaded/progress rendering', () => {
    const app = appFixture({ visibleCatalog: [], catalogQuery: 'no match' });
    const { rerender } = render(<CatalogList app={app} />);
    expect(screen.getByText('Ничего не найдено.')).toBeTruthy();
    rerender(
      <CatalogList
        app={appFixture({ visibleCatalog: [{ id: 7, name: 'Ралли' }], raceProgress: { 7: '42%' } })}
      />,
    );
    expect(screen.getByRole('button', { name: '42%' })).toBeTruthy();
  });

  it('renders race management controls and hides Rally Pack internals', async () => {
    const pkg = {
      id: 'race-101',
      raceId: 101,
      name: 'Sortavala Rally',
      summary: { dates: '26.09.2026', stage: 'СУ 1' },
      geojson: { type: 'FeatureCollection', features: [] },
      assetNames: ['hero.jpg'],
    };
    const app = appFixture({ packages: [pkg] });
    render(<RacesView app={app} />);
    expect(screen.getByLabelText('Удалять автоматически по завершению гонки').checked).toBe(false);
    expect(screen.getByText('Sortavala Rally')).toBeTruthy();
    expect(screen.queryByText(/hero\.jpg|тайлов/i)).toBeNull();
    expect(screen.getByText('Выбрать JSON или GeoJSON')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(app.setAutoDeleteCompletedRaces).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    expect(app.downloadRace).toHaveBeenCalledWith(101);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(app.deleteRace).toHaveBeenCalledWith('race-101');
  });

  it('keeps a stable downloaded races list container in empty and no-match states', () => {
    const { rerender } = render(
      <DownloadedRacesList app={appFixture({ packages: [], packageQuery: '' })} />,
    );
    expect(document.querySelector('#packageList')).toBeTruthy();
    expect(screen.getByText('Скачанных гонок пока нет.')).toBeTruthy();
    rerender(
      <DownloadedRacesList app={appFixture({ packages: [race], packageQuery: 'missing' })} />,
    );
    expect(document.querySelector('#packageList')).toBeTruthy();
    expect(screen.getByText('По этому запросу гонок не найдено.')).toBeTruthy();
  });

  it('renders point lists, favorites, offline actions, and saved packages', () => {
    const app = appFixture({ favorites: [{ lat: 61, lon: 30, name: 'Start', key: 'fav-1' }] });
    const { rerender } = render(
      <>
        <PointList app={app} />
        <FavoritesList app={app} />
        <OfflineMapActions app={app} top />
        <SavedPackagesList app={app} />
      </>,
    );
    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Google Maps' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Открыть' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Удалить карту' })).toBeTruthy();
    expect(screen.getByText('Карелия')).toBeTruthy();
    rerender(
      <>
        <PointList app={appFixture({ currentPackage: { ...race, geojson: { features: [] } } })} />
        <FavoritesList app={appFixture({ favorites: [] })} />
        <SavedPackagesList app={appFixture({ packages: [], visiblePackages: [] })} />
      </>,
    );
    expect(screen.getByText('Точек с координатами нет.')).toBeTruthy();
    expect(screen.getByText('Пока пусто.')).toBeTruthy();
    expect(screen.getByText('Пока ничего не скачано.')).toBeTruthy();
  });

  it('renders saved offline controls and the More navigation menu', () => {
    const onSettings = vi.fn();
    const app = appFixture();
    render(
      <>
        <SavedOfflineSection
          app={app}
          packages={<span>Офлайн</span>}
          stats={<span>1 гонка</span>}
        />
        <MoreMenu onSettings={onSettings} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Настройки и диагностика/ }));
    expect(onSettings).toHaveBeenCalledOnce();
    expect(screen.getByText('Офлайн')).toBeTruthy();
    expect(screen.getByText('РУЧНОЙ ИМПОРТ')).toBeTruthy();
  });

  it('renders schedule, leaders, and push settings with active controls', async () => {
    const pkg = {
      ...race,
      original: {
        ...race.original,
        schedule: [{ location: 'СУ 1', events: [{ time: '10:00', text: 'Старт' }] }],
      },
    };
    render(
      <>
        <ScheduleList pkg={pkg} />
        <TodayLeaders pkg={{ ...pkg, crewResults: { eventResults: [] } }} />
        <PushSettings />
      </>,
    );
    expect(screen.getByText('СУ 1')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Включить уведомления' })).toHaveLength(2),
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Включить уведомления' })[1]);
    await waitFor(() => expect(mocks.enablePushNotifications).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Тестовый пуш через 10 сек' }));
    await waitFor(() => expect(mocks.sendTestPush).toHaveBeenCalled());
  });

  it('shows class leaders and responds to matching crew result updates', () => {
    const pkg = { ...race, crewResults: crewData };
    const onResults = vi.fn();
    render(<TodayLeaders pkg={pkg} onResults={onResults} />);
    expect(screen.getByText('Абсолют · 1 место')).toBeTruthy();
    expect(screen.getByText(/№ 12 · Пилот Иван/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Все результаты' }));
    expect(onResults).toHaveBeenCalledOnce();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('rfm:crew-results-updated', {
          detail: { packageId: race.id + 1, results: { eventResults: [] } },
        }),
      );
    });
    expect(screen.getByText('Абсолют · 1 место')).toBeTruthy();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('rfm:crew-results-updated', {
          detail: { packageId: race.id, results: { eventResults: [] } },
        }),
      );
    });
    expect(screen.getByText(/Результаты пока не загружены/)).toBeTruthy();
  });

  it('subscribes to a stage and handles empty schedules', async () => {
    const pkg = {
      ...race,
      original: { schedule: [{ location: 'СУ 2', events: [{ text: 'Старт' }] }] },
    };
    const { rerender } = render(<ScheduleList pkg={pkg} />);
    fireEvent.click(screen.getByRole('button', { name: 'Включить уведомления' }));
    await waitFor(() => expect(mocks.scheduleRaceReminders).toHaveBeenCalled());
    expect(mocks.setPushStatus).toHaveBeenCalled();
    rerender(<ScheduleList pkg={{ ...pkg, original: { schedule: [] } }} />);
    expect(screen.getByText('Расписание отсутствует.')).toBeTruthy();
  });

  it('renders media galleries and opens/closes the image viewer', () => {
    const { container } = render(<RaceMedia pkg={race} />);
    fireEvent.click(screen.getByRole('button', { name: 'Открыть КАРТА ОРГАНИЗАТОРА 1' }));
    expect(container.querySelector('#imageModal').hidden).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(container.querySelector('#imageModal').hidden).toBe(true);
    expect(screen.getByText('КАК ЭТО БЫЛО')).toBeTruthy();
  });

  it('renders fallback geometry, safety memo, and compass states', () => {
    const { rerender } = render(
      <>
        <FallbackMap geojson={{ features: [feature] }} onPointClick={vi.fn()} />
        <SafetyMemo />
        <CompassReadout />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Офлайн-карта ралли' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Безопасность' })).toBeTruthy();
    expect(screen.getByText('Сначала выбери точку.')).toBeTruthy();
    rerender(
      <>
        <FallbackMap geojson={{ features: [] }} />
        <CompassReadout point={{ lat: 61, lon: 30 }} userPos={{ latitude: 60, longitude: 29 }} />
      </>,
    );
    expect(screen.getByText(/В этом пакете/)).toBeTruthy();
    expect(screen.getByText('Компас включён.')).toBeTruthy();
  });

  it('renders map, race details, and elevation profile', async () => {
    const app = appFixture({
      selectedPoint: { lat: 61, lon: 30, name: 'Start' },
      carPoint: { lat: 60, lon: 29, savedAt: '2026-09-28T08:00:00Z' },
    });
    const { rerender } = render(
      <>
        <MapView
          app={app}
          pointElevation="Высота 20 м"
          mapContent={<span>Карта</span>}
          pointsContent={<span>Точки</span>}
          favoritesContent={<span>Избранное</span>}
        />
        <RaceDetails app={app} schedule={<span>Расписание</span>} media={<span>Медиа</span>} />
        <ElevationProfile route={{ name: 'СУ 1', coordinates: [] }} terrain={race.terrain} />
      </>,
    );
    expect(screen.getByText('Карта')).toBeTruthy();
    expect(screen.getByText(/ЕСТЬ ОБНОВЛЕНИЕ RALLY PACK/)).toBeTruthy();
    expect(screen.getByText('Обновить координаты машины')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText('1.2 км')).toHaveLength(2));
    rerender(
      <>
        <MapView app={appFixture({ currentPackage: null })} mapContent={<span>Нет карты</span>} />
        <RaceDetails app={appFixture({ currentPackage: null })} />
      </>,
    );
    expect(screen.getByText('КАРТА РАЛЛИ')).toBeTruthy();
  });

  it('renders RallyMap loading, fallback, and map lifecycle', async () => {
    const app = appFixture();
    const { rerender } = render(<RallyMap app={appFixture({ currentPackage: null })} />);
    expect(screen.getByText('Выбери сохранённую гонку')).toBeTruthy();
    rerender(<RallyMap app={app} />);
    await waitFor(() => expect(mocks.renderMap).toHaveBeenCalled());
    expect(screen.getByLabelText('Карта ралли')).toBeTruthy();
  });

  it('covers settings and the Today empty state', () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <SettingsView app={appFixture()} onBack={onBack} onDiagnostics={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '☾ Тёмная' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: '← Ещё' }));
    expect(onBack).toHaveBeenCalledOnce();
    rerender(<TodayView app={appFixture({ catalog: [], packages: [], currentPackage: null })} />);
    expect(screen.getByText(/Нет гонки сегодня/)).toBeTruthy();
  });

  it('shows today’s saved rally and its schedule', () => {
    const today = {
      ...race,
      original: {
        ...race.original,
        schedule: [
          {
            date: todayDate,
            location: 'СУ 2',
            events: [{ time: '23:59', text: 'Старт' }],
          },
        ],
      },
    };
    const previous = {
      ...race,
      id: 6,
      raceId: 6,
      name: 'Прошлая гонка',
      original: { status_race: 'Завершена' },
    };
    const app = appFixture({
      catalog: [{ id: 7, name: 'Карелия', dates: todayDate, date_race: todayDate }],
      packages: [today, previous],
      currentPackage: today,
      downloadedIds: new Set([7]),
    });
    const onResults = vi.fn();
    render(<TodayView app={app} onMap={vi.fn()} onResults={onResults} />);
    expect(screen.getByText('Карелия')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Обновить Rally Pack' })).toBeTruthy();
    expect(screen.getByText('Освободи место')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Все результаты' }));
    expect(onResults).toHaveBeenCalledOnce();
  });

  it('builds a Today race-day brief from published schedule, saved results, and pack metadata', () => {
    const packageWithBrief = {
      ...race,
      lastSmartUpdate: {
        appliedAt: '2026-09-29T08:00:00Z',
        changes: [
          { key: 'schedule', label: 'Расписание' },
          { key: 'points', label: 'Точки гонки' },
        ],
      },
      pendingUpdate: null,
      crewResults: { ...crewData, updatedAt: '2026-09-29T09:00:00Z' },
      original: {
        ...race.original,
        status_race: 'Скоро',
        schedule: [
          {
            date: raceDate(1),
            location: 'СУ 1 · старт',
            events: [{ time: '23:59', text: 'Старт экипажа', crewNumber: 12 }],
          },
        ],
      },
    };
    const onMap = vi.fn();
    expect(nextScheduledCrew(packageWithBrief)?.row.crewNumber).toBe(12);
    const { rerender } = render(
      <TodayView
        app={appFixture({
          currentPackage: packageWithBrief,
          packages: [packageWithBrief],
          catalog: [{ id: 7, name: 'Карелия', dates: todayDate }],
          downloadedIds: new Set([7]),
          favoriteCrews: [{ number: 12, name: 'Экипаж № 12' }],
        })}
        onMap={onMap}
      />,
    );

    expect(screen.getByRole('region', { name: 'Состояние ралли' })).toBeTruthy();
    expect(screen.getByText('По расписанию')).toBeTruthy();
    expect(screen.queryByText('LIVE')).toBeNull();
    expect(screen.getByText(/Следующий экипаж/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Избранные экипажи' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Изменения Rally Pack' })).toBeTruthy();
    expect(screen.getByText('Расписание · Точки гонки')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Готовность офлайн' }).textContent).toContain(
      'ОФЛАЙН',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Показать этап на карте' }));
    expect(onMap).toHaveBeenCalledOnce();

    const pending = {
      ...packageWithBrief,
      pendingUpdate: { changes: [{ key: 'schedule', label: 'Время старта СУ 1' }] },
    };
    rerender(
      <TodayView
        app={appFixture({
          currentPackage: pending,
          packages: [pending],
          catalog: [{ id: 7, name: 'Карелия', dates: todayDate }],
          downloadedIds: new Set([7]),
        })}
        onMap={onMap}
      />,
    );
    expect(screen.getByText('ЕСТЬ ИЗМЕНЕНИЯ')).toBeTruthy();
    expect(screen.getByText('Время старта СУ 1')).toBeTruthy();
  });

  it('surfaces saved followed crews on Today for the selected rally', async () => {
    const pkg = { ...race, asmgRaceId: '55', crewResults: crewData };
    mocks.getCrewSubscriptions.mockResolvedValueOnce([
      { key: '55:crew-1', asmgRaceId: '55', raceId: '7', crewId: 'crew-1', name: 'Экипаж 12' },
    ]);
    render(<TodayView app={appFixture({ currentPackage: pkg, packages: [pkg], catalog: [] })} />);
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Избранные экипажи' }).textContent).toContain(
        'Пилот Иван',
      );
    });
  });

  it('offers an upcoming catalog race and marks a downloaded race finished yesterday', () => {
    const upcoming = { id: 8, name: 'Следующая гонка', dates: raceDate(1) };
    const { rerender } = render(
      <TodayView
        app={appFixture({ catalog: [upcoming], packages: [], currentPackage: null })}
        onMap={vi.fn()}
      />,
    );
    expect(screen.getByText('СЛЕДУЮЩАЯ ГОНКА')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Скачать Rally Pack' })).toBeTruthy();

    const finished = {
      ...race,
      id: 6,
      raceId: 6,
      name: 'Прошлая гонка',
      original: {
        ...race.original,
        status_race: 'Завершена',
        dates: raceDate(-1),
        overlap_schedule: ['overlap.jpg'],
      },
      summary: { ...race.summary, dates: raceDate(-1) },
      crewResults: { eventResults: [crewData.eventResults[0]] },
    };
    rerender(
      <TodayView
        app={appFixture({ catalog: [], packages: [finished], currentPackage: finished })}
      />,
    );
    expect(screen.getByText('Гонка завершилась вчера.')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'График перекрытий 1' })).toBeTruthy();
    expect(screen.getByText('Абсолют · 1 место')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rally Pack/ })).toBeNull();
  });

  it('mounts the app, switches tabs, opens settings, and reveals diagnostics by logo taps', async () => {
    window.scrollTo = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const app = appFixture({ currentPackage: null, packages: [], catalog: [], favorites: [] });
    mocks.useRfmApp.mockReturnValue(app);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Ещё/ }));
    fireEvent.click(screen.getByRole('button', { name: /Настройки и диагностика/ }));
    expect(screen.getByRole('heading', { name: 'Настройки и диагностика' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '← Ещё' }));
    for (let index = 0; index < 5; index += 1)
      fireEvent.click(document.getElementById('headerLogo'));
    expect(screen.getByRole('dialog', { name: 'Boot diagnostics' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    await waitFor(() => expect(mocks.syncWalletPassesForPackage).not.toHaveBeenCalled());
  });

  it('selects the numeric package id from the shared rally selector', async () => {
    const nextPackage = { ...race, id: 8, name: 'Пермь' };
    const app = appFixture({
      currentPackage: null,
      packages: [race, nextPackage],
      selectPackage: vi.fn(),
    });
    mocks.useRfmApp.mockReturnValue(app);
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Текущая гонка' }), {
      target: { value: '8' },
    });
    await waitFor(() => expect(app.selectPackage).toHaveBeenCalledWith(8));
  });

  it('covers modal visibility, diagnostics actions, safety scroll gate, and results dialog', async () => {
    const onClose = vi.fn();
    const { rerender, container } = render(
      <>
        <ImageViewerModal image="/map.jpg" onClose={onClose} />
        <BootDiagnostics open={false} onClose={onClose} />
      </>,
    );
    fireEvent.click(container.querySelector('#imageModal'));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(
      <>
        <ImageViewerModal image="" onClose={onClose} />
        <BootDiagnostics open onClose={onClose} />
      </>,
    );
    expect(screen.getByRole('dialog', { name: 'Boot diagnostics' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить хранилище' }));
    await waitFor(() => expect(mocks.collectStorageDiagnostics).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalled();

    render(<SafetyGate fullScreen onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Безопасность' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть правила безопасности' }));

    const gate = render(<SafetyGate onAccept={onClose} />);
    const content = gate.container.querySelector('.safety-gate-content');
    const touchStart = new Event('touchstart', { bubbles: true });
    Object.defineProperty(touchStart, 'touches', { value: [{ clientY: 120 }] });
    content.dispatchEvent(touchStart);
    const touchMove = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(touchMove, 'touches', { value: [{ clientY: 100 }] });
    content.dispatchEvent(touchMove);
    expect(touchMove.defaultPrevented).toBe(true);
    fireEvent.scroll(content);
    fireEvent.click(screen.getByRole('button', { name: /Прокрути памятку|Прочитал/ }));
    expect(onClose).toHaveBeenCalled();

    render(
      <CrewResultsModal
        open
        data={{ eventId: '55' }}
        views={[{ key: 'overall', name: 'Общий итог', results: [result] }]}
        activeView={{ key: 'overall', name: 'Общий итог', results: [result] }}
        className=""
        onClassChange={vi.fn()}
        onStageChange={vi.fn()}
        classes={['Абсолют']}
        query=""
        onQueryChange={vi.fn()}
        visible={[result]}
        selectedClassResults={[result]}
        subscriptions={[]}
        onToggleSubscription={vi.fn()}
        resultLabel={() => 'Иван Пилот'}
        subscriptionKey={() => '55:crew-1'}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Иван Пилот')).toBeTruthy();
  });

  it('loads crew results and renders shared app layout and tab shell', async () => {
    const pkg = { ...race, asmgRaceId: '55', crewResults: crewData };
    render(<CrewResults pkg={pkg} onOpen={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.fetchAsmgResults).toHaveBeenCalled());
    expect(screen.getByText(/сохранено для офлайн-доступа/)).toBeTruthy();

    const app = appFixture({ currentPackage: null, packages: [], catalog: [] });
    const layout = render(
      <AppLayout
        app={app}
        screenContent={<span>Экран</span>}
        mapContent={<span>Map</span>}
        catalogContent={<span>Catalog</span>}
        packagesContent={<span>Packages</span>}
        pointListContent={<span>Points</span>}
        favoritesContent={<span>Favorites</span>}
        updateMessage="Обновление"
      />,
    );
    expect(layout.container.querySelector('.topbar')).toBeTruthy();
    expect(screen.getByText('Экран')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Обновление');
  });
});
