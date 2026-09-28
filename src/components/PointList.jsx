import React, { useMemo } from 'react';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import { pointFeatures, pointFromFeature } from '../app/point-list.js';
import { isFavoritePoint } from '../app/local-points.js';
import {
  googleMapsDirections,
  yandexNavigatorLink,
  yandexWebFallback,
  mapsMeLink,
  mapsMeWebFallback,
  coordinateText,
  openCustomSchemeWithFallback,
} from '../navigation.js';
import './MapView.css';

export default function PointList({ app }) {
  const pkg = app.currentPackage;
  const features = useMemo(() => pointFeatures(pkg?.geojson), [pkg]);
  if (!pkg) return null;
  if (!features.length) return <EmptyState>Точек с координатами нет.</EmptyState>;
  return (
    <>
      {features.map((feature, index) => {
        const point = pointFromFeature(feature);
        const favorite = isFavoritePoint(point, pkg.id);
        const nav = (action, event) => {
          event?.stopPropagation();
          if (action === 'favorite') {
            app.toggleFavorite(point);
            return;
          }
          if (action === 'mapsme') {
            openCustomSchemeWithFallback(mapsMeLink(point), mapsMeWebFallback());
            return;
          }
          if (action === 'yandex') {
            openCustomSchemeWithFallback(yandexNavigatorLink(point), yandexWebFallback(point));
            return;
          }
          if (action === 'google') {
            window.location.href = googleMapsDirections(point);
            return;
          }
          if (action === 'share') {
            app.sharePoint(point);
            return;
          }
          if (action === 'copy')
            navigator.clipboard?.writeText(coordinateText(point)).catch(() => {});
        };
        return (
          <article
            className="point-row"
            data-point-index={index}
            key={`${point.lat}:${point.lon}:${point.name}`}
            onClick={() => app.showPoint(point)}
          >
            <div className="point-row-copy">
              <strong>
                <img className="rfm-icon point-icon" src="/assets/location.svg" alt="" />
                {point.name}
              </strong>
              <span className="muted">{coordinateText(point)}</span>
            </div>
            <div className="point-nav-buttons">
              <Button
                className={`button compact ${favorite ? 'downloaded' : ''}`}
                data-nav="favorite"
                onClick={e => nav('favorite', e)}
              >
                {favorite ? '★ Избранное' : '☆ В избранное'}
              </Button>
              <Button
                className="button compact primary"
                data-nav="mapsme"
                onClick={e => nav('mapsme', e)}
              >
                MAPS.ME
              </Button>
              <Button className="button compact" data-nav="yandex" onClick={e => nav('yandex', e)}>
                Yandex
              </Button>
              <Button className="button compact" data-nav="google" onClick={e => nav('google', e)}>
                Google Maps
              </Button>
              <Button className="button compact" data-nav="share" onClick={e => nav('share', e)}>
                Поделиться
              </Button>
              <Button className="button compact" data-nav="copy" onClick={e => nav('copy', e)}>
                <img className="rfm-icon" src="/assets/document-copy.svg" alt="" />
                Копировать
              </Button>
            </div>
          </article>
        );
      })}
    </>
  );
}
