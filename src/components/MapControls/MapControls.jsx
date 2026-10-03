import './MapControls.css';
import React from 'react';
import { Car, Settings, Star } from 'lucide-react';
import ActionGroup from '../ActionGroup/ActionGroup.jsx';
import Button from '../Button/Button.jsx';
import ElevationProfile from '../ElevationProfile/ElevationProfile.jsx';
import OfflineMapActions from '../OfflineMapActions/OfflineMapActions.jsx';
import {
  coordinateText,
  googleMapsDirections,
  mapsMeLink,
  openCustomSchemeWithFallback,
} from '../../navigation.js';
import { BRAND_ORANGE } from '../../app/design-tokens.js';
import { crewName } from '../../views/ResultsScreen/logic/crew-results.js';

const mapsMeFallbackForPoint = point => `https://maps.me/${point.lat},${point.lon}`;

export default function MapControls({
  app,
  pkg,
  hasRaces,
  toolsOpen,
  setToolsOpen,
  favoritesOpen,
  setFavoritesOpen,
  carOpen,
  setCarOpen,
  liveStage,
  selectedRoute,
  favoritesContent,
  followedResults,
  setCompassOpen,
  openYandex,
}) {
  return (
    <>
      {hasRaces && (
        <>
          <Button
            id="mapToolsToggle"
            className="map-tools-toggle"
            aria-label="Инструменты карты"
            aria-expanded={toolsOpen}
            aria-controls="mapToolsDrawer"
            onClick={() => {
              setToolsOpen(open => !open);
              setFavoritesOpen(false);
              setCarOpen(false);
            }}
          >
            <Settings
              aria-hidden="true"
              size={21}
              style={{ color: toolsOpen ? BRAND_ORANGE : undefined }}
            />
          </Button>
          <Button
            id="mapFavoritesToggle"
            className="map-favorites-toggle"
            aria-label="Избранное"
            aria-expanded={favoritesOpen}
            aria-controls="mapFavoritesDrawer"
            onClick={() => {
              setFavoritesOpen(open => !open);
              setToolsOpen(false);
              setCarOpen(false);
            }}
          >
            <Star
              aria-hidden="true"
              size={21}
              style={{ color: favoritesOpen ? BRAND_ORANGE : undefined }}
            />
          </Button>
          <Button
            id="mapCarToggle"
            className="map-car-toggle"
            aria-label="Моя машина"
            aria-expanded={carOpen}
            aria-controls="mapCarDrawer"
            onClick={() => {
              setCarOpen(open => !open);
              setToolsOpen(false);
              setFavoritesOpen(false);
            }}
          >
            <Car
              aria-hidden="true"
              size={21}
              style={{ color: carOpen ? BRAND_ORANGE : undefined }}
            />
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
          <div
            id="mapToolsDrawer"
            className="map-tools-drawer"
            role="region"
            aria-label="Инструменты карты"
            hidden={!toolsOpen}
          >
            <div className="map-tools-heading map-tools-heading-stacked">
              <div className="block-title">ИНСТРУМЕНТЫ КАРТЫ</div>
              <OfflineMapActions app={app} />
            </div>
            <div className="map-export-actions">
              <div>
                <div className="block-title">ЭКСПОРТ ОФЛАЙН</div>
                <p className="muted small">Экспортирует текущую гонку без обращения к серверу.</p>
              </div>
              <ActionGroup>
                <Button
                  id="exportGpxBtn"
                  className="button"
                  disabled={!pkg}
                  onClick={app.exportGpx}
                >
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
          </div>
          <div
            id="mapFavoritesDrawer"
            className="map-tools-drawer map-favorites-drawer"
            role="region"
            aria-label="Избранное"
            hidden={!favoritesOpen}
          >
            <div className="map-tools-heading">
              <div id="favoritesTitle" className="block-title">
                ИЗБРАННЫЕ ТОЧКИ
              </div>
            </div>
            {app.favorites.length === 0 && followedResults.length === 0 && (
              <div className="map-favorites-empty" role="status">
                <Star aria-hidden="true" size={28} />
                <strong>Пока ничего нет</strong>
                <span>Добавляй точки и экипажи в избранное — они появятся здесь.</span>
              </div>
            )}
            {app.favorites.length > 0 && (
              <section className="favorites-panel" aria-labelledby="favoritesTitle">
                <p id="favoritesStatus" className="muted small">
                  {`${app.favorites.length} сохранено для этой гонки.`}
                </p>
                <div id="favoritesList" className="favorites-list">
                  {favoritesContent}
                </div>
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
          </div>
          <div
            id="mapCarDrawer"
            className="map-tools-drawer map-car-drawer"
            role="region"
            aria-label="Моя машина"
            hidden={!carOpen}
          >
            <div className="map-tools-heading">
              <div id="carTitle" className="block-title">
                ГДЕ МАШИНА?
              </div>
            </div>
            <section className="car-panel" aria-labelledby="carTitle">
              <div className="car-panel-head">
                <p id="carStatus" className="muted small">
                  {app.carPoint
                    ? `Сохранено ${app.carPoint.savedAt ? new Date(app.carPoint.savedAt).toLocaleString() : ''}`
                    : 'Сохрани текущие GPS-координаты машины.'}
                </p>
                <Button id="saveCarBtn" className="button" type="button" onClick={app.saveCar}>
                  {app.carPoint ? 'Обновить координаты машины' : 'Запомнить машину'}
                </Button>
              </div>
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
                      data-point-opener="true"
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
                    <Button
                      id="carDeleteBtn"
                      className="button compact danger"
                      onClick={app.removeCar}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
