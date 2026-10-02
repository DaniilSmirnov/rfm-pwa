import './PointDetailsSheet.css';
import React from 'react';
import { ParkingSquare, Star } from 'lucide-react';
import ActionGroup from '../ActionGroup/ActionGroup.jsx';
import Button from '../Button/Button.jsx';
import CollapsibleSection from '../CollapsibleSection/CollapsibleSection.jsx';
import CompassReadout from '../CompassReadout/CompassReadout.jsx';
import { formatDistance } from '../../app/geo.js';
import {
  coordinateText,
  googleMapsDirections,
  mapsMeLink,
  openCustomSchemeWithFallback,
  yandexNavigatorLink,
  yandexWebFallback,
} from '../../navigation.js';
import { crewName } from '../../views/ResultsScreen/logic/crew-results.js';
import { formatRallyTimeOfDay } from '../../views/MapView/logic/map-details.js';

const mapsMeFallbackForPoint = point => `https://maps.me/${point.lat},${point.lon}`;

export default function PointDetailsSheet({
  app,
  pkg,
  pointSheetPoint,
  pointSheetRef,
  pointDetailsOpen,
  pointSheetClosing,
  pointSheetGesture,
  pointSheetDragProgress,
  selectedDetails,
  pointStageDistance,
  nextStageCrews,
  pointStageResults,
  followedEtas,
  favorite,
  pointElevation,
  compassOpen,
  setCompassOpen,
  beginPointSheetGesture,
  movePointSheetGesture,
  endPointSheetGesture,
  cancelPointSheetGesture,
  setPointDetailsOpen,
  openYandex,
  copyPoint,
}) {
  return (
    <>
      {pointSheetPoint && (
      <>
        <Button
          id="mapPointSheetBackdrop"
          className={`map-point-sheet-backdrop ${pointDetailsOpen ? 'is-interactive' : ''}`}
          type="button"
          aria-label="Закрыть карточку точки"
          tabIndex={pointDetailsOpen ? 0 : -1}
          onClick={() => app.showPoint?.(null)}
        />
        <aside
          ref={pointSheetRef}
          id="pointActions"
          className={`point-actions map-point-sheet ${pointDetailsOpen ? 'is-expanded' : ''} ${pointSheetClosing ? 'is-closing' : ''} ${pointSheetGesture.current.startY != null ? 'is-dragging' : ''}`}
          style={{ '--point-sheet-progress': pointSheetDragProgress }}
          role="dialog"
          aria-modal={pointDetailsOpen ? 'true' : undefined}
          aria-labelledby="pointName"
          onPointerDown={beginPointSheetGesture}
          onPointerUp={endPointSheetGesture}
          onPointerCancel={cancelPointSheetGesture}
          onTouchStart={beginPointSheetGesture}
          onTouchMove={movePointSheetGesture}
          onTouchEnd={endPointSheetGesture}
          onTouchCancel={cancelPointSheetGesture}
        >
          <Button
            className="map-point-sheet-handle"
            type="button"
            aria-expanded={pointDetailsOpen}
            aria-controls="mapPointDetails"
            aria-label={
              pointDetailsOpen ? 'Свернуть карточку точки' : 'Развернуть карточку точки'
            }
            onClick={() => {
              if (pointSheetGesture.current.suppressClick) {
                pointSheetGesture.current.suppressClick = false;
                return;
              }
              setPointDetailsOpen(open => !open);
            }}
          >
            <span className="map-point-sheet-grabber" aria-hidden="true" />
            <span id="pointName" className="map-point-sheet-title">
              {pointSheetPoint.name || 'Точка на карте'}
            </span>
            <span className="sr-only">
              {pointDetailsOpen ? 'Свернуть карточку точки' : 'Развернуть карточку точки'}
            </span>
          </Button>
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
                  alt={`Фото: ${pointSheetPoint.name}`}
                />
              </a>
            )}
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
          <div
            id="mapPointDetails"
            className="map-point-sheet-details"
            aria-hidden={!pointDetailsOpen}
          >
            <span id="pointCoords" className="muted">
              {coordinateText(pointSheetPoint)}
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
                onClick={() => app.toggleFavorite(pointSheetPoint)}
              >
                {favorite ? '★ В избранном' : '☆ В избранное'}
              </Button>
              <Button
                id="mapsMeBtn"
                className="button primary"
                onClick={() =>
                  openCustomSchemeWithFallback(
                    mapsMeLink(pointSheetPoint),
                    mapsMeFallbackForPoint(pointSheetPoint),
                  )
                }
              >
                MAPS.ME
              </Button>
              <Button
                id="yandexMapsBtn"
                className="button"
                onClick={() => openYandex(pointSheetPoint)}
              >
                Yandex Navigator
              </Button>
              <Button
                id="googleMapsBtn"
                className="button"
                onClick={() => (window.location.href = googleMapsDirections(pointSheetPoint))}
              >
                Google Maps
              </Button>
              <Button
                id="sharePointBtn"
                className="button"
                onClick={() => app.sharePoint(pointSheetPoint)}
              >
                Поделиться
              </Button>
              <Button
                id="copyCoordsBtn"
                className="button"
                onClick={() => void copyPoint(pointSheetPoint)}
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
                Показывает направление и расстояние до выбранной точки прямо по положению
                телефона.
              </p>
              <Button
                id="compassEnableBtn"
                className="button"
                type="button"
                onClick={app.enableCompass}
              >
                {app.compassEnabled ? 'Компас включён' : 'Включить компас'}
              </Button>
              <CompassReadout point={pointSheetPoint} userPos={app.userPos} />
            </CollapsibleSection>
          </div>
        </aside>
      </>
      )}
    </>
  );
}
