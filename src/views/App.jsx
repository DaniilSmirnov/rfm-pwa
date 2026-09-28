import '../components/SharedControls.css';
import '../components/AppShell.css';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Button from '../components/Button.jsx';
import { CalendarDays, CircleEllipsis, Map } from 'lucide-react';
import { useRfmApp, formatBytes } from '../hooks/useRfmApp.js';
import { resizeActiveMap } from '../map.js';
import { syncWalletPassesForPackage } from '../app/wallet-client.js';
import { pointElevationText } from '../app/elevation-ui.js';
import TodayView from './TodayView.jsx';
import { nearestStageDistance } from '../app/point-stage-distance.js';
import SafetyGate from '../modals/SafetyGate.jsx';
import SettingsView from './SettingsView.jsx';
import PwaInstallPrompt from '../components/PwaInstallPrompt.jsx';
import AppLayout from './AppLayout.jsx';
import AppFooter from '../components/AppFooter.jsx';
import CatalogList from '../components/CatalogList.jsx';
import SavedPackagesList from '../components/SavedPackagesList.jsx';
import PointList from '../components/PointList.jsx';
import FavoritesList from '../components/FavoritesList.jsx';
import RallyMap from '../components/RallyMap.jsx';
import MoreMenu from '../components/MoreMenu.jsx';
import ScheduleList from '../components/ScheduleList.jsx';
import RaceMedia from '../components/RaceMedia.jsx';
import CrewResults from '../components/CrewResults.jsx';
import BootDiagnostics from '../modals/BootDiagnostics.jsx';
import { hasSafetyConsent, saveSafetyConsent } from '../app/safety-consent.js';
import { raceHasFinished } from '../app/today-summary.js';

const tabs = [
  { key: 'today', label: 'Сегодня', Icon: CalendarDays },
  { key: 'map', label: 'Карта', Icon: Map },
  { key: 'more', label: 'Ещё', Icon: CircleEllipsis },
];
function readTab() {
  return new URLSearchParams(location.search).get('tab') || 'today';
}
export default function App() {
  const app = useRfmApp();
  const pkg = app.currentPackage;
  const pointStageDistance = useMemo(
    () => nearestStageDistance(pkg, app.selectedPoint),
    [pkg, app.selectedPoint],
  );
  const [tab, setTab] = useState(readTab());
  const [moreScreen, setMoreScreen] = useState('menu');
  const [crewResultsOpen, setCrewResultsOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [pointElevation, setPointElevation] = useState('Высота: выбери точку.');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(() => hasSafetyConsent(pkg));
  const [clock, setClock] = useState(() => new Date());
  const [updateMessage, setUpdateMessage] = useState('');
  const scrollPositions = useRef({});
  const activeScrollKey = tab === 'more' ? `more:${moreScreen}` : tab;
  const restoreScrollKey = useRef(activeScrollKey);
  const activate = next => {
    scrollPositions.current[activeScrollKey] = window.scrollY;
    restoreScrollKey.current = next === 'more' ? `more:${moreScreen}` : next;
    const url = new URL(location.href);
    url.searchParams.set('tab', next);
    history.pushState({ tab: next }, '', url);
    setTab(next);
    if (next !== 'more') setMoreScreen('menu');
  };

  useEffect(() => {
    document.body.dataset.activeTab = tab;
    document.body.dataset.moreScreen = moreScreen;
  }, [tab, moreScreen]);

  useEffect(() => {
    setSafetyAccepted(hasSafetyConsent(pkg));
  }, [pkg?.id, pkg?.original?.safety_leaflet]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onUpdate = event => setUpdateMessage(event.detail?.message || 'Обновляю приложение…');
    window.addEventListener('rfm:service-worker-update', onUpdate);
    return () => window.removeEventListener('rfm:service-worker-update', onUpdate);
  }, []);

  useEffect(() => {
    const update = () => {
      const next = new URLSearchParams(location.search).get('tab') || 'today';
      scrollPositions.current[activeScrollKey] = window.scrollY;
      setMoreScreen('menu');
      setTab(next);
      restoreScrollKey.current = next;
    };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, [activeScrollKey]);

  useEffect(() => {
    const save = () => {
      scrollPositions.current[activeScrollKey] = window.scrollY;
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [activeScrollKey]);

  useLayoutEffect(() => {
    const key = restoreScrollKey.current;
    let second = 0;
    const first = requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositions.current[key] || 0);
      second = requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[key] || 0));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [activeScrollKey]);

  useEffect(() => {
    if (tab === 'map') requestAnimationFrame(() => resizeActiveMap());
  }, [tab]);

  const logoTaps = useRef([]);
  const handleLogoClick = () => {
    const now = Date.now();
    logoTaps.current = logoTaps.current.filter(timestamp => now - timestamp < 2500);
    logoTaps.current.push(now);
    if (logoTaps.current.length >= 5) {
      logoTaps.current = [];
      setDiagnosticsOpen(true);
    }
  };

  useEffect(() => {
    if (pkg)
      syncWalletPassesForPackage(pkg).catch(e => console.warn('Wallet pass refresh failed', e));
  }, [pkg?.id, pkg?.savedAt]);

  useEffect(() => {
    let cancelled = false;
    if (!app.selectedPoint) {
      setPointElevation('Высота: выбери точку.');
      return undefined;
    }
    pointElevationText(pkg?.terrain, app.selectedPoint).then(text => {
      if (!cancelled) setPointElevation(text);
    });
    document
      .getElementById('pointActions')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return () => {
      cancelled = true;
    };
  }, [app.selectedPoint, pkg?.terrain?.storageId]);

  useEffect(() => setSelectedRoute(null), [pkg?.id]);

  const requiresSafety = tab === 'map' && !safetyAccepted;
  useEffect(() => {
    document.body.dataset.safetyGate = requiresSafety ? 'true' : 'false';
  }, [requiresSafety]);
  const acceptSafety = () => {
    saveSafetyConsent(pkg);
    setSafetyAccepted(true);
  };
  const openSettings = () => {
    scrollPositions.current[activeScrollKey] = window.scrollY;
    restoreScrollKey.current = 'more:settings';
    setMoreScreen('settings');
  };
  const closeSettings = () => {
    scrollPositions.current[activeScrollKey] = window.scrollY;
    restoreScrollKey.current = 'more:menu';
    setMoreScreen('menu');
  };
  const openCrewResults = () => setCrewResultsOpen(true);
  const screenContent =
    tab === 'today' ? (
      <TodayView app={app} onMap={() => activate('map')} onResults={openCrewResults} />
    ) : tab === 'more' ? (
      moreScreen === 'settings' ? (
        <SettingsView
          app={app}
          onBack={closeSettings}
          onDiagnostics={() => setDiagnosticsOpen(true)}
        />
      ) : (
        <MoreMenu onSettings={openSettings} />
      )
    ) : null;

  return (
    <>
      <AppLayout
        app={app}
        selectedRoute={selectedRoute}
        onLogoClick={handleLogoClick}
        pointElevation={pointElevation}
        pointStageDistance={pointStageDistance}
        installPrompt={<PwaInstallPrompt active={tab === 'today'} />}
        screenContent={screenContent}
        updateMessage={updateMessage}
        mapContent={<RallyMap app={app} onRouteClick={setSelectedRoute} />}
        catalogContent={<CatalogList app={app} />}
        packagesContent={<SavedPackagesList app={app} />}
        statsContent={
          <>
            <strong>{app.storageStats.count} гонок</strong>
            <span className="muted">
              JSON: {formatBytes(app.storageStats.jsonBytes)} · карты:{' '}
              {formatBytes(app.storageStats.mapBytes)} ({app.storageStats.mapCount} тайлов) ·
              persistent: {app.storageStats.persisted ? 'да' : 'нет'}
            </span>
          </>
        }
        pointListContent={<PointList app={app} />}
        favoritesContent={<FavoritesList app={app} />}
        scheduleContent={pkg && <ScheduleList pkg={pkg} />}
        mediaContent={<RaceMedia pkg={pkg} />}
      />
      <BootDiagnostics open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
      <AppFooter />
      <nav className="bottom-tabbar" aria-label="Основная навигация">
        {tabs.map(({ key, label, Icon }) => (
          <Button
            key={key}
            className={tab === key ? 'active' : ''}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => activate(key)}
          >
            <Icon aria-hidden="true" size={21} strokeWidth={tab === key ? 2.4 : 1.8} />
            <b>{label}</b>
          </Button>
        ))}
      </nav>

      <CrewResults
        pkg={
          pkg && (!raceHasFinished(pkg, clock) || pkg.crewResults?.eventResults?.length)
            ? pkg
            : null
        }
        open={crewResultsOpen}
        onOpen={openCrewResults}
        onClose={() => setCrewResultsOpen(false)}
      />

      {requiresSafety && <SafetyGate pkg={pkg} onAccept={acceptSafety} />}
    </>
  );
}
