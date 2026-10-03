import './ElevationProfileSheet.css';
import React, { useEffect, useRef } from 'react';
import Button from '../Button/Button.jsx';
import ElevationProfile from '../ElevationProfile/ElevationProfile.jsx';

const timingFields = [
  ['road_closes_at', 'Закрытие дороги'],
  ['first_zero_at', 'Нулевой экипаж'],
  ['first_crew_at', 'Первый экипаж'],
  ['last_crew_at', 'Последний экипаж'],
  ['road_opens_at', 'Открытие дороги'],
];

function stageNumber(route) {
  const match = String(route?.name || '').match(/(?:СУ|SS)\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

export default function ElevationProfileSheet({ route, terrain, overlapSchedule, onClose }) {
  const sheetRef = useRef(null);
  const stage = overlapSchedule?.stages?.find(item => item.number === stageNumber(route));

  useEffect(() => {
    if (!route) return undefined;
    const previousFocus = document.activeElement;
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => sheetRef.current?.querySelector('button')?.focus());
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [route, onClose]);

  if (!route) return null;

  return (
    <>
      <Button
        id="elevationProfileSheetBackdrop"
        className="map-point-sheet-backdrop is-interactive"
        type="button"
        aria-label="Закрыть профиль высот"
        onClick={onClose}
      />
      <aside
        ref={sheetRef}
        id="elevationProfileSheet"
        className="point-actions map-point-sheet is-expanded elevation-profile-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="elevationProfileSheetTitle"
      >
        <Button
          className="map-point-sheet-handle"
          type="button"
          aria-label="Закрыть профиль высот"
          onClick={onClose}
        >
          <span className="map-point-sheet-grabber" aria-hidden="true" />
          <span id="elevationProfileSheetTitle" className="map-point-sheet-title">
            {route.name || 'Профиль высот'}
          </span>
        </Button>
        <div className="elevation-profile-sheet-content">
          <ElevationProfile route={route} terrain={terrain} showTitle={false} />
          {stage ? (
            <section className="elevation-timings" aria-label="Тайминги перекрытия">
              <div className="block-title">ТАЙМИНГИ ПЕРЕКРЫТИЯ</div>
              <p className="muted small">
                {overlapSchedule.event} · {overlapSchedule.date}
              </p>
              <dl>
                {timingFields.map(([field, label]) =>
                  stage[field] ? (
                    <div key={field}>
                      <dt>{label}</dt>
                      <dd>{stage[field]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {stage.last_crew_time_approximate && (
                <p className="muted small">Время последнего экипажа ориентировочное.</p>
              )}
            </section>
          ) : (
            <p className="muted small">Тайминги перекрытия для этого СУ не опубликованы.</p>
          )}
        </div>
      </aside>
    </>
  );
}
