import '../components/SharedControls.css';
import '../components/AppShell.css';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRfmApp } from '../hooks/useRfmApp.js';
import { resizeActiveMap } from '../map.js';
import { syncWalletPassesForPackage } from '../app/wallet-client.js';
import { pointElevationText } from '../app/elevation-ui.js';
import { nearestStageDistance } from '../app/point-stage-distance.js';
import SafetyGate from '../modals/SafetyGate.jsx';
import PwaInstallPrompt from '../components/PwaInstallPrompt.jsx';
import AppLayout from './AppLayout.jsx';
import AppFooter from '../components/AppFooter.jsx';
import PointList from '../components/PointList.jsx';
import FavoritesList from '../components/FavoritesList.jsx';
import RallyMap from '../components/RallyMap.jsx';
import ScheduleList from '../components/ScheduleList.jsx';
import RaceMedia from '../components/RaceMedia.jsx';
import BootDiagnostics from '../modals/BootDiagnostics.jsx';
import { hasSafetyConsent, saveSafetyConsent } from '../app/safety-consent.js';
import { selectedPackage } from '../app/rally-context.js';
import { useEdgeSwipeBack } from '../components/ScreenHeader.jsx';
import AppScreens, { getScreenHeaderTitle } from './AppScreens.jsx';
import AppTabBar from '../components/AppTabBar.jsx';

function readTab() {
  const requested = new URLSearchParams(location.search).get('tab');
  if (requested === 'races') return 'more';
  return ['today', 'map', 'results', 'more'].includes(requested) ? requested : 'today';
}
function readMoreScreen() {
  return new URLSearchParams(location.search).get('tab') === 'races' ? 'races' : 'menu';
}
export default function App() {
  const app = useRfmApp();
  const pkg = app.currentPackage;
  const pointStageDistance = useMemo(
    () => nearestStageDistance(pkg, app.selectedPoint),
    [pkg, app.selectedPoint],
  );
  const [tab, setTab] = useState(readTab());
  const [moreScreen, setMoreScreen] = useState(readMoreScreen);
  const [crewResultsOpen, setCrewResultsOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [pointElevation, setPointElevation] = useState('Высота: выбери точку.');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(() => hasSafetyConsent(pkg));
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
    setMoreScreen('menu');
  };

  useEffect(() => {
    setSafetyAccepted(hasSafetyConsent(pkg));
  }, [pkg]);

  useEffect(() => {
    const onUpdate = event => setUpdateMessage(event.detail?.message || 'Обновляю приложение…');
    window.addEventListener('rfm:service-worker-update', onUpdate);
    return () => window.removeEventListener('rfm:service-worker-update', onUpdate);
  }, []);

  useEffect(() => {
    const update = () => {
      const next = readTab();
      scrollPositions.current[activeScrollKey] = window.scrollY;
      setMoreScreen(readMoreScreen());
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
  }, [pkg]);

  useEffect(() => {
    let cancelled = false;
    if (!app.selectedPoint) {
      setPointElevation('Высота: выбери точку.');
      return undefined;
    }
    pointElevationText(pkg?.terrain, app.selectedPoint).then(text => {
      if (!cancelled) setPointElevation(text);
    });
    return () => {
      cancelled = true;
    };
  }, [app.selectedPoint, pkg?.terrain]);

  useEffect(() => setSelectedRoute(null), [pkg?.id]);

  const requiresSafety = tab === 'map' && !safetyAccepted;
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
  const openRaces = () => {
    scrollPositions.current[activeScrollKey] = window.scrollY;
    restoreScrollKey.current = 'more:races';
    const url = new URL(location.href);
    url.searchParams.set('tab', 'more');
    history.pushState({ tab: 'more' }, '', url);
    setMoreScreen('races');
    setTab('more');
  };
  const returnToMoreMenu = useCallback(() => {
    setMoreScreen('menu');
    const url = new URL(location.href);
    url.searchParams.set('tab', 'more');
    history.replaceState({ tab: 'more' }, '', url);
  }, []);
  const screenHeaderTitle = getScreenHeaderTitle(tab, moreScreen);

  useEdgeSwipeBack(returnToMoreMenu, Boolean(screenHeaderTitle));
  const screenContent = (
    <AppScreens
      app={app}
      tab={tab}
      moreScreen={moreScreen}
      crewResultsOpen={crewResultsOpen}
      onMap={() => activate('map')}
      onResults={() => activate('results')}
      onRaces={openRaces}
      onOpenRaces={openRaces}
      onOpenCrewResults={() => setCrewResultsOpen(true)}
      onCloseCrewResults={() => setCrewResultsOpen(false)}
      onSettings={openSettings}
      onRacesMenu={() => setMoreScreen('races')}
      onOpenSection={setMoreScreen}
      onNotifications={openSettings}
      onTheme={openSettings}
      onDiagnostics={() => setDiagnosticsOpen(true)}
      onBackSettings={closeSettings}
      onBackMore={returnToMoreMenu}
      onOpenRace={async id => {
        await app.selectPackage(id);
        activate('map');
      }}
    />
  );

  return (
    <div
      className="app-shell"
      data-active-tab={tab}
      data-more-screen={moreScreen}
      data-safety-gate={requiresSafety}
    >
      <AppLayout
        app={app}
        selectedRoute={selectedRoute}
        onLogoClick={handleLogoClick}
        pointElevation={pointElevation}
        pointStageDistance={pointStageDistance}
        installPrompt={<PwaInstallPrompt />}
        screenContent={screenContent}
        updateMessage={updateMessage}
        onSelectRally={id => {
          const selected = selectedPackage(app.packages, id);
          if (selected) void app.selectPackage(selected.id);
        }}
        onOpenRaces={openRaces}
        mapContent={<RallyMap app={app} onRouteClick={setSelectedRoute} />}
        pointListContent={<PointList app={app} />}
        favoritesContent={<FavoritesList app={app} />}
        scheduleContent={pkg && <ScheduleList pkg={pkg} />}
        mediaContent={<RaceMedia pkg={pkg} />}
        screenHeader={
          screenHeaderTitle ? { title: screenHeaderTitle, onBack: returnToMoreMenu } : null
        }
      />
      <BootDiagnostics open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
      <AppFooter />
      <AppTabBar activeTab={tab} onActivate={activate} />

      {requiresSafety && <SafetyGate pkg={pkg} onAccept={acceptSafety} />}
    </div>
  );
}
