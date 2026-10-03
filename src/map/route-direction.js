import { distanceMeters } from '../app/geo.js';
import { buildStageDescriptors, findStageDescriptorByFeature } from '../app/schedule.js';
import { orientStageRoute } from './route-orientation.js';

export const ROUTE_DIRECTION_INTERVAL = 2000;

export const ROUTE_DIRECTION_PATTERN_ID = 'rfm-route-direction-pattern';

function directionPatternImage() {
  const width = 64;
  const height = 24;
  const data = new Uint8Array(width * height * 4);
  const white = [255, 255, 255, 255];
  const halfHeight = (height - 1) / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inShaft = x >= 4 && x <= 30 && y >= 9 && y <= 14;
      const progress = Math.max(0, Math.min(1, (x - 24) / 34));
      const headHalfHeight = Math.max(0.75, 12 * (1 - progress));
      const inHead = x >= 24 && x <= 58 && Math.abs(y - halfHeight) <= headHalfHeight;

      if (!inShaft && !inHead) continue;
      data.set(white, (y * width + x) * 4);
    }
  }

  return { width, height, data };
}

export function installRouteDirectionPatterns(map) {
  if (!map?.addImage || !map?.addLayer) return [];

  if (!map.hasImage?.(ROUTE_DIRECTION_PATTERN_ID)) {
    map.addImage(ROUTE_DIRECTION_PATTERN_ID, directionPatternImage(), { pixelRatio: 1 });
  }

  const layers = [
    {
      id: 'rfm-lines-direction',
      source: 'rfm-lines',
      width: ['interpolate', ['linear'], ['zoom'], 5, 3, 12, 6, 17, 9],
    },
    {
      id: 'rfm-yandex-lines-direction',
      source: 'rfm-yandex-lines',
      width: ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 7, 17, 10],
    },
  ];

  return layers
    .filter(layer => {
      if (map.getLayer?.(layer.id)) return false;
      map.addLayer({
        id: layer.id,
        type: 'line',
        source: layer.source,
        minzoom: 0,
        maxzoom: 24,
        layout: { 'line-cap': 'butt', 'line-join': 'miter' },
        paint: {
          'line-pattern': ROUTE_DIRECTION_PATTERN_ID,
          'line-width': layer.width,
          'line-opacity': 0.95,
        },
      });
      return true;
    })
    .map(layer => layer.id);
}

const mercatorY = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const valid = c =>
  Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[1]) < 90;

export function routeKilometreMarkers(geometry) {
  const lines =
    geometry?.type === 'LineString'
      ? [geometry.coordinates]
      : geometry?.type === 'MultiLineString'
        ? geometry.coordinates
        : [];
  const markers = [];
  let travelled = 0,
    next = ROUTE_DIRECTION_INTERVAL;
  for (const line of lines) {
    for (let i = 1; i < (line || []).length; i += 1) {
      const a = line[i - 1],
        b = line[i];
      if (!valid(a) || !valid(b)) continue;
      const length = distanceMeters({ lon: a[0], lat: a[1] }, { lon: b[0], lat: b[1] });
      if (!length) continue;
      // A north-facing arrow follows the exact direction of the projected road.
      const dx = ((b[0] - a[0]) * Math.PI) / 180,
        dy = mercatorY(b[1]) - mercatorY(a[1]);
      const rotation = (Math.atan2(dx, dy) * 180) / Math.PI;
      while (next <= travelled + length) {
        const t = (next - travelled) / length;
        const lat =
          ((2 * Math.atan(Math.exp(mercatorY(a[1]) + dy * t)) - Math.PI / 2) * 180) / Math.PI;
        markers.push({
          coordinates: [a[0] + (b[0] - a[0]) * t, lat],
          rotation,
          distance: next,
        });
        next += ROUTE_DIRECTION_INTERVAL;
      }
      travelled += length;
    }
  }
  return markers;
}

export function installRouteDirections(map, maplibregl, collections, pkg = {}) {
  if (!maplibregl?.Marker) return [];
  const markers = [];
  const stages = buildStageDescriptors(pkg);
  for (const collection of collections) {
    for (const feature of collection?.features || []) {
      const props = feature.properties || {};
      const name =
        props['name:ru'] || props.name_ru || props.name || props.title || props.caption || 'СУ';
      const stage = findStageDescriptorByFeature(stages, feature);
      const geometry = orientStageRoute(feature, pkg.geojson?.features, stage);
      for (const point of routeKilometreMarkers(geometry)) {
        const el = document.createElement('div');
        el.className = 'map-route-direction';
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', `Направление движения: ${name}, ${point.distance / 1000} км`);
        markers.push(
          new maplibregl.Marker({
            element: el,
            anchor: 'center',
            rotation: point.rotation,
            rotationAlignment: 'map',
            pitchAlignment: 'map',
          })
            .setLngLat(point.coordinates)
            .addTo(map),
        );
      }
    }
  }
  return markers;
}
