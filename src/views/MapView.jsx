import React, { useEffect, useState } from 'react';
import { Layers, MapPin, ChevronDown, ArrowRight, Star, ParkingSquare } from 'lucide-react';
import ActionGroup from '../components/ActionGroup.jsx';
import Button from '../components/Button.jsx';
import {
  googleMapsDirections,
  yandexNavigatorLink,
  yandexWebFallback,
  coordinateText,
  openCustomSchemeWithFallback,
} from '../navigation.js';
import { isFavoritePoint } from '../app/local-points.js';
import { formatDistance } from '../app/geo.js';
import {
  stageMapStatuses,
  pointFeatureDetails,
  scheduledStageCrews,
  formatRallyTimeOfDay,
  stagePointResults,
} from '../app/map-details.js';
import { mapsMeLink } from '../navigation.js';
import OfflineMapActions from '../components/OfflineMapActions.jsx';
import Panel from '../components/Panel.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import ElevationProfile from '../components/ElevationProfile.jsx';
import CompassReadout from '../components/CompassReadout.jsx';
import { getCrewSubscriptions } from '../db.js';
import { BRAND_ORANGE } from '../app/design-tokens.js';
import { crewName, overallCrewResults } from '../app/crew-results.js';
import '../components/MapView.css';

const mapsMeFallbackForPoint = point => `https://maps.me/${point.lat},${point.lon}`;

export default function MapView({
  app,
  selectedRoute,
  pointElevation,
  pointStageDistance,
  pointsContent,
  favoritesContent,
  mapContent,
}) {
  const [compassOpen, setCompassOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [pointDetailsOpen, setPointDetailsOpen] = useState(false);
  const [crewSubscriptions, setCrewSubscriptions] = useState([]);
  const pkg = app.currentPackage;
  const favorite = Boolean(pkg && app.selectedPoint && isFavoritePoint(app.selectedPoint, pkg.id));
  const stages = pkg ? stageMapStatuses(pkg) : [];
  const liveStage = stages.find(stage => stage.mapStatusKind === 'live');
  const selectedDetails =
    pkg && app.selectedPoint ? pointFeatureDetails(pkg, app.selectedPoint) : null;
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
    if (app.selectedPoint) setToolsOpen(false);
  }, [app.selectedPoint]);
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
          <img className="map-brand-logo" src="/rfm/icon.png" alt="Rally Fans Map" />
        </span>
        <label className="current-rally-select map-rally-picker">
          <MapPin aria-hidden="true" size={20} className="current-rally-pin" />
          <span className="current-rally-copy">
            <strong id="mapTitle">{pkg?.name || 'КАРТА РАЛЛИ'}</strong>
            <small>{pkg?.summary?.dates || pkg?.dates || ''}</small>
          </span>
          {app.packages?.length > 0 && (
            <select
              aria-label="Гонка на карте"
              value={pkg?.id || ''}
              onChange={event => {
                const selected = app.packages.find(item => String(item.id) === event.target.value);
                if (selected) void app.selectPackage(selected.id);
              }}
            >
              {!pkg && <option value="">Выбрать гонку</option>}
              {app.packages.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
          <ChevronDown aria-hidden="true" size={16} />
        </label>
        <span id="mapSubtitle" className="sr-only">
          {app.mapSubtitle}
        </span>
      </header>
      <div className="map" aria-label="offline rally map">
        {mapContent}
      </div>
      <Button
        id="mapToolsToggle"
        className="map-tools-toggle"
        aria-label={toolsOpen ? 'Закрыть инструменты' : 'Инструменты карты'}
        aria-expanded={toolsOpen}
        aria-controls="mapToolsDrawer"
        onClick={() => setToolsOpen(open => !open)}
      >
        <Layers aria-hidden="true" size={21} />
      </Button>
      {liveStage && (
        <div className="map-live-stage" aria-label="Активный спецучасток">
          <span aria-hidden="true" />
          <strong>{liveStage.name}</strong>
          <small>{liveStage.mapStatus}</small>
        </div>
      )}
      <div className="map-locate-control">
        <Button
          id="locateBtn"
          className="map-locate-button"
          aria-label="Показать где я"
          onClick={app.requestLocation}
        >
          <img className="rfm-icon" src="/assets/location.svg" alt="" />
        </Button>
        <span id="geoStatus" className={`map-locate-status ${app.geoClass}`} aria-live="polite">
          {app.geoStatus}
        </span>
      </div>
      <div id="mapToolsDrawer" className="map-tools-drawer" hidden={!toolsOpen}>
        <div className="map-tools-heading">
          <strong>Инструменты карты</strong>
          <OfflineMapActions app={app} />
        </div>
        <section className="favorites-panel" aria-labelledby="favoritesTitle">
          <SectionHeader className="compact-section-head">
            <div>
              <div id="favoritesTitle" className="block-title">
                ИЗБРАННЫЕ ТОЧКИ
              </div>
              <p id="favoritesStatus" className="muted small">
                {app.favorites.length
                  ? `${app.favorites.length} сохранено для этой гонки.`
                  : 'Добавляй точки в избранное, чтобы они были всегда под рукой.'}
              </p>
            </div>
          </SectionHeader>
          <div id="favoritesList" className="favorites-list">
            {favoritesContent}
          </div>
        </section>
        <section className="car-panel" aria-labelledby="carTitle">
          <SectionHeader className="compact-section-head">
            <div>
              <div id="carTitle" className="block-title">
                ГДЕ МАШИНА?
              </div>
              <p id="carStatus" className="muted small">
                {app.carPoint
                  ? `Сохранено ${app.carPoint.savedAt ? new Date(app.carPoint.savedAt).toLocaleString() : ''}`
                  : 'Сохрани текущие GPS-координаты машины.'}
              </p>
            </div>
            <Button id="saveCarBtn" className="button" type="button" onClick={app.saveCar}>
              {app.carPoint ? 'Обновить координаты машины' : 'Запомнить машину'}
            </Button>
          </SectionHeader>
          {app.carPoint && (
            <div id="carPointCard" className="car-point-card">
              <div className="point-row-copy">
                <strong>🚗 Машина</strong>
                <span id="carCoords" className="muted">
                  {coordinateText(app.carPoint)}
                </span>
              </div>
              <div className="point-nav-buttons">
                <Button
                  id="carCompassBtn"
                  className="button compact"
                  onClick={async () => {
                    setCompassOpen(true);
                    app.showPoint(app.carPoint);
                    await app.enableCompass();
                  }}
                >
                  Компас
                </Button>
                <Button
                  id="carMapsMeBtn"
                  className="button compact primary"
                  onClick={() =>
                    openCustomSchemeWithFallback(
                      mapsMeLink(app.carPoint),
                      mapsMeFallbackForPoint(app.carPoint),
                    )
                  }
                >
                  MAPS.ME
                </Button>
                <Button
                  id="carYandexBtn"
                  className="button compact"
                  onClick={() => openYandex(app.carPoint)}
                >
                  Yandex
                </Button>
                <Button
                  id="carGoogleBtn"
                  className="button compact"
                  onClick={() => (window.location.href = googleMapsDirections(app.carPoint))}
                >
                  Google Maps
                </Button>
                <Button
                  id="carShareBtn"
                  className="button compact"
                  onClick={() => app.sharePoint(app.carPoint)}
                >
                  Поделиться
                </Button>
                <Button id="carDeleteBtn" className="button compact danger" onClick={app.removeCar}>
                  Удалить
                </Button>
              </div>
            </div>
          )}
        </section>
        {stages.length > 0 && (
          <section className="map-stage-statuses" aria-labelledby="mapStageStatusesTitle">
            <div id="mapStageStatusesTitle" className="block-title">
              СТАТУСЫ СПЕЦУЧАСТКОВ
            </div>
            <div className="map-stage-status-list">
              {stages.map(stage => (
                <article className="map-stage-status" key={stage.key}>
                  <strong>{stage.name}</strong>
                  <span className={`map-stage-pill is-${stage.mapStatusKind}`}>
                    {stage.mapStatus}
                  </span>
                  <span className="muted small">{stage.date || stage.location}</span>
                </article>
              ))}
            </div>
            <p className="muted small">
              Статус показан по последнему опубликованному сообщению расписания.
            </p>
          </section>
        )}
        {followedResults.length > 0 && (
          <section className="map-followed-crews" aria-label="Избранные экипажи">
            <div className="block-title">ИЗБРАННЫЕ ЭКИПАЖИ</div>
            {followedResults.map(({ favorite, position, result }) => {
              const stage = pkg.crewResults?.eventResults?.at(-1);
              const stageResult = stage?.results?.find(row =>
                [row.crew?.id, row.crew?.number].some(
                  value => String(value) === String(favorite.id || favorite.number),
                ),
              );
              return (
                <article className="map-followed-crew" key={favorite.id || favorite.number}>
                  <strong>
                    {position + 1}. № {result.crew?.number || favorite.number || '—'} ·{' '}
                    {crewName(result.crew) || favorite.name}
                  </strong>
                  <span>
                    {result.formattedTime} ·{' '}
                    {result.formattedFromLeader === '00:00:00:0'
                      ? 'лидер'
                      : `отставание ${result.formattedFromLeader}`}
                    {stage?.specialStage?.name &&
                      ` · ${stage.specialStage.name}: ${stageResult?.formattedTime || 'результат не опубликован'}`}
                  </span>
                </article>
              );
            })}
          </section>
        )}
        <div className="map-field-notice" role="note">
          <strong>Безопасность и офлайн</strong>
          <span>
            Оставайся в разрешённых зрительских зонах и следуй указаниям маршалов. Скачай
            офлайн-карту до выезда; доступность внешнего навигатора и его офлайн-карт зависит от
            самого приложения.
          </span>
        </div>
        <div className="map-export-actions">
          <div>
            <div className="block-title">ЭКСПОРТ ОФЛАЙН</div>
            <p className="muted small">Экспортирует текущую гонку без обращения к серверу.</p>
          </div>
          <ActionGroup>
            <Button id="exportGpxBtn" className="button" disabled={!pkg} onClick={app.exportGpx}>
              GPX
            </Button>
            <Button
              id="exportGeoJsonBtn"
              className="button"
              disabled={!pkg}
              onClick={app.exportGeoJson}
            >
              GeoJSON
            </Button>
          </ActionGroup>
        </div>
        <div className="map-location-controls">
          <p className={`muted small ${app.geoClass}`}>{app.geoStatus}</p>
        </div>
        <ElevationProfile route={selectedRoute} terrain={pkg?.terrain} />
        <div className="legend">
          <span>
            <i style={{ background: '#f3f5f7' }} />
            RallyFansMap
          </span>
          <span>
            <i style={{ background: BRAND_ORANGE }} />
            Yandex Constructor
          </span>
          <span>
            <i style={{ background: '#4da3ff' }} />
            вы
          </span>
        </div>
        <div className="full-width-line" />
        <CollapsibleSection
          className="points-panel"
          summary={
            <>
              <span className="block-title">ГДЕ СМОТРЕТЬ?</span>
              <span className="summary-chevron">⌄</span>
            </>
          }
        >
          <p className="muted small">
            Точки можно открыть во внешнем навигаторе без доступа к геопозиции PWA.
          </p>
          <div id="pointList" className="point-list">
            {pointsContent}
          </div>
        </CollapsibleSection>
      </div>
      {app.selectedPoint && (
        <aside
          id="pointActions"
          className={`point-actions map-point-sheet ${pointDetailsOpen ? 'is-expanded' : ''}`}
        >
          <div className={`point-actions-copy ${selectedDetails?.photo ? 'has-photo' : ''}`}>
            {selectedDetails?.photo && (
              <a
                className="map-point-sheet-photo-link"
                href={selectedDetails.photo}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  className="map-point-sheet-photo"
                  src={selectedDetails.photo}
                  alt={`Фото: ${app.selectedPoint.name}`}
                />
              </a>
            )}

            <strong id="pointName">{app.selectedPoint.name}</strong>
            <span className="map-point-sheet-meta">
              {pointStageDistance
                ? `${pointStageDistance.stage.name} · ${formatDistance(pointStageDistance.distance.fromStart)} от старта`
                : 'Точка на карте'}
            </span>
            {selectedDetails?.rating && (
              <span className="map-point-summary">
                <Star size={14} aria-hidden="true" /> {selectedDetails.rating}
              </span>
            )}
            {selectedDetails?.walking && (
              <span className="map-point-summary map-point-walking">
                <ParkingSquare size={14} aria-hidden="true" /> {selectedDetails.walking}
              </span>
            )}
          </div>
          <Button
            className="button map-point-details-toggle"
            aria-expanded={pointDetailsOpen}
            aria-controls="mapPointDetails"
            onClick={() => setPointDetailsOpen(open => !open)}
          >
            {pointDetailsOpen ? 'Скрыть детали' : 'Показать детали'}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
          <div id="mapPointDetails" className="map-point-sheet-details" hidden={!pointDetailsOpen}>
            <span id="pointCoords" className="muted">
              {coordinateText(app.selectedPoint)}
            </span>
            <span id="pointStageDistance" className="muted small">
              {pointStageDistance
                ? `${pointStageDistance.stage.name}: ${formatDistance(pointStageDistance.distance.fromStart)} от старта · ${formatDistance(pointStageDistance.distance.toFinish)} до финиша`
                : ''}
            </span>
            {(selectedDetails?.parking || selectedDetails?.walking) && (
              <dl className="map-point-access">
                {selectedDetails.parking && (
                  <>
                    <dt>Парковка</dt>
                    <dd>{selectedDetails.parking}</dd>
                  </>
                )}
                {selectedDetails.walking && (
                  <>
                    <dt>Пешком</dt>
                    <dd>{selectedDetails.walking}</dd>
                  </>
                )}
              </dl>
            )}
            {(selectedDetails?.description || selectedDetails?.rating) && (
              <div className="map-point-description">
                {selectedDetails.description && <p>{selectedDetails.description}</p>}
                {selectedDetails.rating && <p>Оценка точки: {selectedDetails.rating}</p>}
              </div>
            )}
            {nextStageCrews.length > 0 && (
              <section className="map-point-next-crews" aria-label="Следующие экипажи на этапе">
                <strong>Следующие старты на {pointStageDistance.stage.name}</strong>
                <ol>
                  {nextStageCrews.map(crew => (
                    <li key={crew.id}>
                      {crew.number ? `№ ${crew.number}` : crew.name} · старт {crew.time}
                      {crew.eta &&
                        ` · ориентировочное прибытие около ${formatRallyTimeOfDay(crew.eta, pkg)}`}
                    </li>
                  ))}
                </ol>
                <small>
                  {nextStageCrews.some(crew => crew.eta)
                    ? 'Старт опубликован организатором. Прибытие рассчитано по среднему темпу экипажей с результатом на этом СУ; оценка дана без live GPS.'
                    : 'Время старта опубликовано организатором. Данных о темпе на этом СУ пока нет, ETA не рассчитывается.'}
                </small>
              </section>
            )}
            {pointStageResults && (
              <section className="map-point-stage-results" aria-label="Результаты этапа у точки">
                <strong>Обстановка на {pointStageDistance.stage.name}</strong>
                <p>
                  По опубликованному протоколу СУ завершили экипажей:{' '}
                  {pointStageResults.completedCount}.
                </p>
                {pointStageResults.bestResult && (
                  <p>
                    Лучший результат: № {pointStageResults.bestResult.crew?.number || '—'}{' '}
                    {crewName(pointStageResults.bestResult.crew)} ·{' '}
                    {pointStageResults.bestResult.formattedTime || 'время не отформатировано'}
                  </p>
                )}
                <small>
                  Отдельные отметки времени прохождения этой зрительской точки не опубликованы.
                </small>
              </section>
            )}
            {followedEtas.length > 0 && (
              <section className="map-favorite-etas" aria-label="Оценка избранных экипажей">
                <strong>Избранные экипажи · оценка у точки</strong>
                {followedEtas.map(({ favorite, scheduled }) => (
                  <p key={favorite.id || favorite.number}>
                    № {scheduled.number || favorite.number} · около{' '}
                    {formatRallyTimeOfDay(scheduled.eta, pkg)}
                  </p>
                ))}
              </section>
            )}
            <ActionGroup className="point-buttons">
              <Button
                id="favoritePointBtn"
                className={`button ${favorite ? 'downloaded' : ''}`}
                onClick={() => app.toggleFavorite(app.selectedPoint)}
              >
                {favorite ? '★ В избранном' : '☆ В избранное'}
              </Button>
              <Button
                id="mapsMeBtn"
                className="button primary"
                onClick={() =>
                  openCustomSchemeWithFallback(
                    mapsMeLink(app.selectedPoint),
                    mapsMeFallbackForPoint(app.selectedPoint),
                  )
                }
              >
                MAPS.ME
              </Button>
              <Button
                id="yandexMapsBtn"
                className="button"
                onClick={() => openYandex(app.selectedPoint)}
              >
                Yandex Navigator
              </Button>
              <Button
                id="googleMapsBtn"
                className="button"
                onClick={() => (window.location.href = googleMapsDirections(app.selectedPoint))}
              >
                Google Maps
              </Button>
              <Button
                id="sharePointBtn"
                className="button"
                onClick={() => app.sharePoint(app.selectedPoint)}
              >
                Поделиться
              </Button>
              <Button
                id="copyCoordsBtn"
                className="button"
                onClick={() => void copyPoint(app.selectedPoint)}
              >
                Копировать
              </Button>
            </ActionGroup>
            <p id="pointElevation" className="muted small">
              {pointElevation}
            </p>
            <p id="navStatus" className="muted small">
              {app.navStatus}
            </p>
            <CollapsibleSection
              id="spectatorCompass"
              open={compassOpen}
              onToggle={event => setCompassOpen(event.currentTarget.open)}
              className="spectator-compass"
              bodyClassName="spectator-compass-body"
              summary={
                <>
                  <span className="block-title">КОМПАС ЗРИТЕЛЯ</span>
                  <span className="summary-chevron">⌄</span>
                </>
              }
            >
              <p className="muted small">
                Показывает направление и расстояние до выбранной точки прямо по положению телефона.
              </p>
              <Button
                id="compassEnableBtn"
                className="button"
                type="button"
                onClick={app.enableCompass}
              >
                {app.compassEnabled ? 'Компас включён' : 'Включить компас'}
              </Button>
              <CompassReadout point={app.selectedPoint} userPos={app.userPos} />
            </CollapsibleSection>
          </div>
        </aside>
      )}
    </Panel>
  );
}
