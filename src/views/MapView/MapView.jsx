import './MapView.css';
import PointDetailsSheet from '../../components/PointDetailsSheet/PointDetailsSheet.jsx';
import ElevationProfileSheet from '../../components/ElevationProfileSheet/ElevationProfileSheet.jsx';
import MapControls from '../../components/MapControls/MapControls.jsx';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import packageMeta from '../../../package.json';
import SelectField from '../../components/SelectField/SelectField.jsx';
import {
  yandexNavigatorLink,
  yandexWebFallback,
  coordinateText,
  openCustomSchemeWithFallback,
} from '../../navigation.js';
import { isFavoritePoint } from '../../app/local-points.js';
import {
  stageMapStatuses,
  pointFeatureDetails,
  scheduledStageCrews,
  stagePointResults,
} from './logic/map-details.js';
import EmptyScreenState from '../../components/EmptyScreenState/EmptyScreenState.jsx';
import Panel from '../../components/Panel/Panel.jsx';
import { getCrewSubscriptions } from '../../db.js';
import { overallCrewResults } from '../ResultsScreen/logic/crew-results.js';
import sortavalaOverlapSchedule from '../../data/sortavala-overlap-schedule.json';
import { isSortavalaRace } from '../TodayView/logic/overlap-schedule.js';
export default function MapView({
  app,
  selectedRoute,
  pointElevation,
  pointStageDistance,
  favoritesContent,
  mapContent,
  onOpenRaces,
}) {
  const [compassOpen, setCompassOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [carOpen, setCarOpen] = useState(false);
  const [pointDetailsOpen, setPointDetailsOpen] = useState(false);
  const [elevationProfileOpen, setElevationProfileOpen] = useState(false);
  const [pointSheetDragProgress, setPointSheetDragProgress] = useState(0);
  const [pointSheetPoint, setPointSheetPoint] = useState(app.selectedPoint);
  const [pointSheetClosing, setPointSheetClosing] = useState(false);
  const [crewSubscriptions, setCrewSubscriptions] = useState([]);
  const pointSheetRef = useRef(null);
  const pointSheetPointRef = useRef(app.selectedPoint);
  const pointSheetGesture = useRef({ startY: null, suppressClick: false });
  const selectedPointRef = useRef(app.selectedPoint);
  const selectedPoint = app.selectedPoint;
  const showPoint = app.showPoint;
  selectedPointRef.current = app.selectedPoint;
  pointSheetPointRef.current = pointSheetPoint;
  const pkg = app.currentPackage;
  const overlapSchedule =
    pkg?.overlapSchedule ||
    pkg?.original?.overlapSchedule ||
    (isSortavalaRace(pkg) ? sortavalaOverlapSchedule : null);
  const hasRaces = app.packages?.length > 0;
  const favorite = Boolean(pkg && app.selectedPoint && isFavoritePoint(app.selectedPoint, pkg.id));
  const stages = pkg ? stageMapStatuses(pkg) : [];
  const liveStage = stages.find(stage => stage.mapStatusKind === 'live');
  const selectedDetails = pkg && pointSheetPoint ? pointFeatureDetails(pkg, pointSheetPoint) : null;
  const scheduledCrews =
    pkg && pointStageDistance
      ? scheduledStageCrews(
          pkg,
          pointStageDistance.stage?.name,
          new Date(),
          pointStageDistance.distance?.fromStart,
        )
      : [];
  const nextStageCrews = scheduledCrews.slice(0, 3);
  const pointStageResults =
    pkg && pointStageDistance ? stagePointResults(pkg, pointStageDistance.stage?.name) : null;
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => getCrewSubscriptions())
      .then(items => {
        if (alive) setCrewSubscriptions(Array.isArray(items) ? items : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pkg?.id]);
  useEffect(() => {
    if (app.selectedPoint) {
      setToolsOpen(false);
      setFavoritesOpen(false);
      setCarOpen(false);
    }
  }, [app.selectedPoint]);
  useEffect(() => {
    if (!selectedRoute) {
      setElevationProfileOpen(false);
      return;
    }
    // A route click is the explicit entry point for the elevation profile.
    // Keep the profile in the same bottom-sheet modal family as point details.
    setElevationProfileOpen(true);
    setToolsOpen(false);
    setFavoritesOpen(false);
    setCarOpen(false);
  }, [selectedRoute]);
  useEffect(() => {
    if (app.selectedPoint) {
      setPointSheetPoint(app.selectedPoint);
      setPointSheetClosing(false);
      return undefined;
    }
    if (!pointSheetPointRef.current) return undefined;
    setPointDetailsOpen(false);
    setPointSheetClosing(true);
    const timer = window.setTimeout(() => {
      pointSheetPointRef.current = null;
      setPointSheetPoint(null);
      setPointSheetClosing(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [app.selectedPoint]);
  useEffect(() => {
    if (!toolsOpen && !favoritesOpen && !carOpen) return undefined;
    const toolsTrigger = document.getElementById('mapToolsToggle');
    const favoritesTrigger = document.getElementById('mapFavoritesToggle');
    const carTrigger = document.getElementById('mapCarToggle');
    const toolsDrawer = document.getElementById('mapToolsDrawer');
    const favoritesDrawer = document.getElementById('mapFavoritesDrawer');
    const carDrawer = document.getElementById('mapCarDrawer');
    const activeTrigger = toolsOpen ? toolsTrigger : favoritesOpen ? favoritesTrigger : carTrigger;
    const closePanels = () => {
      setToolsOpen(false);
      setFavoritesOpen(false);
      setCarOpen(false);
      requestAnimationFrame(() => activeTrigger?.focus());
    };
    const handlePointerDown = event => {
      const target = event.target;
      if (
        toolsDrawer?.contains(target) ||
        favoritesDrawer?.contains(target) ||
        carDrawer?.contains(target) ||
        toolsTrigger?.contains(target) ||
        favoritesTrigger?.contains(target) ||
        carTrigger?.contains(target)
      ) {
        return;
      }
      closePanels();
    };
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePanels();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toolsOpen, favoritesOpen, carOpen]);
  useEffect(() => setPointDetailsOpen(false), [app.selectedPoint]);
  const beginPointSheetGesture = event => {
    if (event.type.startsWith('pointer') && event.pointerType === 'touch') return;
    const handleTarget = event.target.closest?.('.map-point-sheet-handle');
    const interactiveTarget = event.target.closest?.(
      'button:not(.map-point-sheet-handle), a, input, select, textarea, summary',
    );
    if (interactiveTarget && !handleTarget) return;
    const source = event.touches?.[0] || event;
    pointSheetGesture.current = { startY: source.clientY, suppressClick: false };
    setPointSheetDragProgress(pointDetailsOpen ? 1 : 0);
    handleTarget?.setPointerCapture?.(event.pointerId);
    if (!handleTarget) event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const movePointSheetGesture = event => {
    if (event.type.startsWith('pointer') && event.pointerType === 'touch') return;
    const startY = pointSheetGesture.current.startY;
    const source = event.touches?.[0] || event;
    if (startY == null) return;
    const delta = source.clientY - startY;
    const progress = pointDetailsOpen ? 1 - delta / 220 : -delta / 220;
    setPointSheetDragProgress(Math.max(0, Math.min(1, progress)));
    if (Math.abs(delta) > 4) event.preventDefault?.();
  };
  const endPointSheetGesture = event => {
    if (event.type.startsWith('pointer') && event.pointerType === 'touch') return;
    const startY = pointSheetGesture.current.startY;
    const source = event.changedTouches?.[0] || event;
    pointSheetGesture.current.startY = null;
    if (startY == null) return;
    const delta = source.clientY - startY;
    if (Math.abs(delta) < 36) return;
    event.preventDefault?.();
    pointSheetGesture.current.suppressClick = true;
    if (delta > 0) {
      if (pointDetailsOpen) {
        setPointDetailsOpen(false);
        setPointSheetDragProgress(0);
      } else app.showPoint?.(null);
    } else {
      setPointDetailsOpen(true);
      setPointSheetDragProgress(1);
    }
  };
  const cancelPointSheetGesture = event => {
    if (event.type.startsWith('pointer') && event.pointerType === 'touch') return;
    pointSheetGesture.current = { startY: null, suppressClick: false };
  };
  useEffect(() => {
    if (!selectedPoint) return undefined;
    const sheet = pointSheetRef.current;
    const previousFocus = document.activeElement;
    const closePoint = () => showPoint?.(null);
    const focusable = () =>
      [...(sheet?.querySelectorAll('button, a, input, select, textarea, [tabindex]') || [])].filter(
        node => !node.disabled && !node.closest('[hidden]') && node.tabIndex >= 0,
      );
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePoint();
        return;
      }
      if (event.key !== 'Tab' || !sheet) return;
      if (!pointDetailsOpen) return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onDocumentClick = event => {
      if (
        sheet?.contains(event.target) ||
        event.target.closest?.('.point-row, [data-point-opener], .map-race-label, .map-point') ||
        event.target.closest?.('#mapPointSheetBackdrop')
      ) {
        return;
      }
      const pointAtClick = selectedPointRef.current;
      setTimeout(() => {
        if (selectedPointRef.current === pointAtClick) closePoint();
      }, 0);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onDocumentClick);
    if (pointDetailsOpen)
      requestAnimationFrame(() => sheet?.querySelector('.map-point-sheet-handle')?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onDocumentClick);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, [selectedPoint, showPoint, pointDetailsOpen]);
  const raceKey = String(pkg?.raceId || pkg?.original?.id || pkg?.id || '');
  const asmgKey = String(pkg?.asmgRaceId || pkg?.original?.asmg_id || pkg?.original?.asmgId || '');
  const followed = crewSubscriptions
    .filter(item => item.raceId === raceKey || (asmgKey && item.asmgRaceId === asmgKey))
    .map(item => ({ id: item.crewId, number: item.number, name: item.name }));
  const overallResults = overallCrewResults(pkg?.crewResults?.eventResults);
  const followedResults = followed
    .map(favorite => ({
      favorite,
      position: overallResults.findIndex(result =>
        [result.crew?.id, result.crew?.number].some(
          value => String(value) === String(favorite.id || favorite.number),
        ),
      ),
    }))
    .filter(item => item.position >= 0)
    .map(item => ({ ...item, result: overallResults[item.position] }));
  const followedEtas = followedResults
    .map(item => ({
      ...item,
      scheduled: scheduledCrews.find(crew =>
        [crew.id, crew.number].some(value =>
          [item.favorite.id, item.favorite.number].some(
            favoriteId => String(value) === String(favoriteId),
          ),
        ),
      ),
    }))
    .filter(item => item.scheduled?.eta);
  const openYandex = point =>
    openCustomSchemeWithFallback(yandexNavigatorLink(point), yandexWebFallback(point));
  const copyPoint = async point => {
    const text = coordinateText(point);
    try {
      await navigator.clipboard.writeText(text);
      app.setNavStatus(`Скопировано: ${text}`);
    } catch {
      app.setNavStatus(`Координаты: ${text}`);
    }
  };
  return (
    <Panel id="mapSection" className="map-card legacy-map map-screen">
      <header className="map-floating-header">
        <span className="map-brand" aria-label="Rally Fans Map">
          <img
            className="map-brand-logo"
            src={`/rfm/icon.png?v=${String(packageMeta.version).replace(/\D/g, '')}`}
            alt="Rally Fans Map"
          />
        </span>
        {hasRaces && (
          <label className="current-rally-select map-rally-picker">
            <MapPin aria-hidden="true" size={20} className="current-rally-pin" />
            <span className="current-rally-copy">
              <strong id="mapTitle">{pkg?.name || 'КАРТА РАЛЛИ'}</strong>
              <small>{pkg?.summary?.dates || pkg?.dates || ''}</small>
            </span>
            <SelectField
              aria-label="Гонка на карте"
              className="map-rally-field"
              value={pkg?.id || ''}
              onChange={event => {
                const selected = app.packages.find(item => String(item.id) === event.target.value);
                if (selected) void app.selectPackage(selected.id);
              }}
            >
              {app.packages.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SelectField>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
        )}
        <span id="mapSubtitle" className="sr-only">
          {app.mapSubtitle}
        </span>
      </header>
      {hasRaces ? (
        <div className="map" aria-label="offline rally map">
          {mapContent}
        </div>
      ) : (
        <EmptyScreenState
          className="map-empty-state"
          description="Скачай Rally Pack в разделе управления гонками, чтобы открыть карту."
          onAction={onOpenRaces}
        />
      )}
      <MapControls
        app={app}
        pkg={pkg}
        hasRaces={hasRaces}
        toolsOpen={toolsOpen}
        setToolsOpen={setToolsOpen}
        favoritesOpen={favoritesOpen}
        setFavoritesOpen={setFavoritesOpen}
        carOpen={carOpen}
        setCarOpen={setCarOpen}
        liveStage={liveStage}
        favoritesContent={favoritesContent}
        followedResults={followedResults}
        setCompassOpen={setCompassOpen}
        openYandex={openYandex}
      />
      <PointDetailsSheet
        app={app}
        pkg={pkg}
        pointSheetPoint={pointSheetPoint}
        pointSheetRef={pointSheetRef}
        pointDetailsOpen={pointDetailsOpen}
        pointSheetClosing={pointSheetClosing}
        pointSheetGesture={pointSheetGesture}
        pointSheetDragProgress={pointSheetDragProgress}
        selectedDetails={selectedDetails}
        pointStageDistance={pointStageDistance}
        nextStageCrews={nextStageCrews}
        pointStageResults={pointStageResults}
        followedEtas={followedEtas}
        favorite={favorite}
        pointElevation={pointElevation}
        compassOpen={compassOpen}
        setCompassOpen={setCompassOpen}
        beginPointSheetGesture={beginPointSheetGesture}
        movePointSheetGesture={movePointSheetGesture}
        endPointSheetGesture={endPointSheetGesture}
        cancelPointSheetGesture={cancelPointSheetGesture}
        setPointDetailsOpen={setPointDetailsOpen}
        openYandex={openYandex}
        copyPoint={copyPoint}
      />
      {elevationProfileOpen && (
        <ElevationProfileSheet
          route={selectedRoute}
          terrain={pkg?.terrain}
          overlapSchedule={overlapSchedule}
          onClose={() => setElevationProfileOpen(false)}
        />
      )}
    </Panel>
  );
}
