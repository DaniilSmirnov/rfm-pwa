import React, { useState } from 'react';
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
import { stageMapStatuses, pointFeatureDetails } from '../app/map-details.js';
import { mapsMeLink } from '../navigation.js';
import OfflineMapActions from '../components/OfflineMapActions.jsx';
import Panel from '../components/Panel.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import ElevationProfile from '../components/ElevationProfile.jsx';
import CompassReadout from '../components/CompassReadout.jsx';
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
  const pkg = app.currentPackage;
  const favorite = Boolean(pkg && app.selectedPoint && isFavoritePoint(app.selectedPoint, pkg.id));
  const stages = pkg ? stageMapStatuses(pkg) : [];
  const selectedDetails =
    pkg && app.selectedPoint ? pointFeatureDetails(pkg, app.selectedPoint) : null;
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
    <Panel id="mapSection" className="map-card legacy-map">
      <SectionHeader>
        <div>
          <div id="mapTitle" className="block-title">
            {pkg?.name || 'КАРТА РАЛЛИ'}
          </div>
          <p id="mapSubtitle" className="muted">
            {app.mapSubtitle}
          </p>
        </div>
        <OfflineMapActions app={app} />
      </SectionHeader>
      <div className="map" aria-label="offline rally map">
        {mapContent}
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
      <div className="map-field-notice" role="note">
        <strong>Безопасность и офлайн</strong>
        <span>
          Оставайся в разрешённых зрительских зонах и следуй указаниям маршалов. Скачай офлайн-карту
          до выезда; доступность внешнего навигатора и его офлайн-карт зависит от самого приложения.
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
        <Button id="locateBtn" className="button" onClick={app.requestLocation}>
          <img className="rfm-icon" src="/assets/location.svg" alt="" />
          Показать где я
        </Button>
        <p id="geoStatus" className={`muted small ${app.geoClass}`}>
          {app.geoStatus}
        </p>
      </div>
      <ElevationProfile route={selectedRoute} terrain={pkg?.terrain} />
      <div className="legend">
        <span>
          <i style={{ background: '#f3f5f7' }} />
          RallyFansMap
        </span>
        <span>
          <i style={{ background: '#ffd21e' }} />
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
      {app.selectedPoint && (
        <aside id="pointActions" className="point-actions">
          <div className="point-actions-copy">
            <div className="eyebrow">выбранная точка</div>
            <strong id="pointName">{app.selectedPoint.name}</strong>
            <span id="pointCoords" className="muted">
              {coordinateText(app.selectedPoint)}
            </span>
          </div>
          <span id="pointStageDistance" className="muted small">
            {pointStageDistance
              ? `${pointStageDistance.stage.name}: ${formatDistance(pointStageDistance.distance.fromStart)} от старта · ${formatDistance(pointStageDistance.distance.toFinish)} до финиша`
              : ''}
          </span>
          {selectedDetails?.photo && (
            <a
              className="map-point-photo-link"
              href={selectedDetails.photo}
              target="_blank"
              rel="noreferrer"
            >
              <img
                className="map-point-photo"
                src={selectedDetails.photo}
                alt={`Фото: ${app.selectedPoint.name}`}
                loading="lazy"
              />
              <span>Открыть фото точки</span>
            </a>
          )}
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
        </aside>
      )}
    </Panel>
  );
}
