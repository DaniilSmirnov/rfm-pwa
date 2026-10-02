import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BRAND_ORANGE } from './app/design-tokens.js';
import { geometryBounds } from './normalize.js';
import { baseStyle } from './map/style.js';
import { applyOfflineViewportConstraints, offlineViewportOptions } from './map/viewport-policy.js';
import { TerrainModeControl } from './map/terrain-control.js';
import { installRouteDirectionPatterns } from './map/route-direction.js';
import { createPointMarkerContent, pointWithMarkerIcon } from './map/point-marker.js';
import BasemapPopup from './components/BasemapPopup.jsx';

let activeMap = null;
let activeRaceLabelMarkers = [];

function clearMarkers(list) {
  for (const marker of list) {
    try {
      marker.remove();
    } catch {}
  }
  list.length = 0;
}

function clearAllLabels() {
  clearMarkers(activeRaceLabelMarkers);
}

function expandBounds(bounds, userPos) {
  if (!bounds) return null;
  let { minLon, minLat, maxLon, maxLat } = bounds;
  if (userPos && Number.isFinite(userPos.longitude) && Number.isFinite(userPos.latitude)) {
    minLon = Math.min(minLon, userPos.longitude);
    maxLon = Math.max(maxLon, userPos.longitude);
    minLat = Math.min(minLat, userPos.latitude);
    maxLat = Math.max(maxLat, userPos.latitude);
  }
  const dx = Math.max(maxLon - minLon, 0.002),
    dy = Math.max(maxLat - minLat, 0.002);
  const padX = dx * 0.08,
    padY = dy * 0.08;
  return {
    minLon: minLon - padX,
    maxLon: maxLon + padX,
    minLat: minLat - padY,
    maxLat: maxLat + padY,
  };
}

function splitFeatures(fc = { type: 'FeatureCollection', features: [] }) {
  const features = Array.isArray(fc.features) ? fc.features : [];
  const lineFeatures = features.filter(f =>
    ['LineString', 'MultiLineString'].includes(f?.geometry?.type),
  );
  const isYandex = feature =>
    String(feature?.properties?.kind || '').startsWith('yandex-') ||
    feature?.properties?.source === 'yandex-constructor';
  return {
    lines: { type: 'FeatureCollection', features: lineFeatures.filter(f => !isYandex(f)) },
    yandexLines: { type: 'FeatureCollection', features: lineFeatures.filter(isYandex) },
    polygons: {
      type: 'FeatureCollection',
      features: features.filter(f => ['Polygon', 'MultiPolygon'].includes(f?.geometry?.type)),
    },
    points: {
      type: 'FeatureCollection',
      features: features.filter(f => f?.geometry?.type === 'Point'),
    },
  };
}

function routePayload(feature) {
  return {
    name: String(
      feature?.properties?.name ||
        feature?.properties?.title ||
        feature?.properties?.caption ||
        'Участок',
    ),
    geometry: feature?.geometry || null,
    properties: { ...(feature?.properties || {}) },
    feature,
  };
}

function pointPayload(feature) {
  const c = feature?.geometry?.coordinates || [];
  return {
    lat: Number(c[1]),
    lon: Number(c[0]),
    name: String(feature?.properties?.name || feature?.properties?.title || 'Точка'),
  };
}

function sourceColorExpression() {
  return BRAND_ORANGE;
}

function featureName(props = {}) {
  return String(
    props['name:ru'] || props.name_ru || props.name || props.title || props.caption || '',
  ).trim();
}

function installBasemapInspector(map, offlineMap) {
  if (!offlineMap?.ready || !window.maplibregl?.Popup) return;
  let popup = null;
  const closePopup = () => {
    popup?.remove();
    popup = null;
  };
  map.on('remove', closePopup);
  map.on('click', e => {
    try {
      if (
        map.getLayer('rfm-points') &&
        map.queryRenderedFeatures(e.point, { layers: ['rfm-points'] }).length
      )
        return;
      const layers = (map.getStyle()?.layers || [])
        .filter(layer => layer.source === 'offline-base')
        .map(layer => layer.id);
      if (!layers.length) return;
      const features = map.queryRenderedFeatures(e.point, { layers });
      if (!features.length) return;
      const interesting = [
        'name',
        'name:ru',
        'kind',
        'kind_detail',
        'ref',
        'shield_text',
        'network',
        'oneway',
        'service',
        'is_link',
        'is_bridge',
        'is_tunnel',
        'population',
        'population_rank',
        'capital',
        'wikidata',
        'cuisine',
        'religion',
        'sport',
        'iata',
        'reservoir',
        'intermittent',
        'alkaline',
        'layer',
        'disputed',
        'addr_housenumber',
        'min_zoom',
        'sort_rank',
      ];
      const score = feature =>
        interesting.reduce(
          (n, key) =>
            n +
            (feature?.properties?.[key] !== undefined && feature?.properties?.[key] !== '' ? 1 : 0),
          0,
        );
      const feature = [...features].sort((a, b) => score(b) - score(a))[0];
      if (!feature || score(feature) === 0) return;
      closePopup();
      const content = document.createElement('div');
      const root = createRoot(content);
      flushSync(() => root.render(React.createElement(BasemapPopup, { feature })));
      let mounted = true;
      const unmount = () => {
        if (!mounted) return;
        mounted = false;
        root.unmount();
      };
      popup = new window.maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '330px',
        className: 'basemap-popup',
      })
        .on('close', unmount)
        .setLngLat(e.lngLat)
        .setDOMContent(content)
        .addTo(map);
    } catch (error) {
      console.warn('basemap feature inspector failed', error);
    }
  });
}

function installRacePointLabels(map, points, onPointClick, { alwaysVisible = false } = {}) {
  clearMarkers(activeRaceLabelMarkers);
  const maplibregl = window.maplibregl;
  if (!maplibregl?.Marker) return;

  const labels = (points?.features || [])
    .filter(f => f?.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
    .map(f => pointWithMarkerIcon(f))
    .map(f => ({ feature: f, name: featureName(f.properties), coords: f.geometry.coordinates }))
    .filter(x => x.name);

  for (const item of labels) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'map-label map-race-label';
    createPointMarkerContent(el, item.name, item.feature.properties.markerIcon);
    el.title = item.name;
    if (onPointClick)
      el.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        onPointClick(pointPayload(item.feature));
      });
    const marker = new maplibregl.Marker({ element: el, anchor: 'left', offset: [-15, 0] })
      .setLngLat(item.coords)
      .addTo(map);
    activeRaceLabelMarkers.push(marker);
  }

  const update = () => {
    const visible = alwaysVisible || map.getZoom() >= 9;
    for (const marker of activeRaceLabelMarkers) {
      const el = marker.getElement();
      el.style.display = visible ? 'flex' : 'none';
    }
  };
  update();
  map.on('zoom', update);
}

export function applyTerrainMode(map, mode) {
  if (!map || typeof map.setTerrain !== 'function') return false;
  const nextMode = mode === '3d' ? '3d' : 'hillshade';
  try {
    map.setTerrain(nextMode === '3d' ? { source: 'offline-terrain-3d', exaggeration: 1.35 } : null);
    if (map.getLayer?.('terrain-hillshade') && map.setLayoutProperty)
      map.setLayoutProperty(
        'terrain-hillshade',
        'visibility',
        nextMode === '3d' ? 'none' : 'visible',
      );
    const currentBearing = Number(map.getBearing?.());
    map.easeTo?.({
      bearing: nextMode === '3d' && Number.isFinite(currentBearing) ? currentBearing : 0,
      pitch: nextMode === '3d' ? 70 : 0,
      duration: 450,
    });
    return true;
  } catch {
    return false;
  }
}

export function isPositionWithinMapBounds(map, longitude, latitude) {
  const bounds = map?.getMaxBounds?.();
  if (!bounds) return true;
  if (typeof bounds.contains === 'function') return Boolean(bounds.contains([longitude, latitude]));
  const southWest = bounds.getSouthWest?.();
  const northEast = bounds.getNorthEast?.();
  if (!southWest || !northEast) return true;
  return (
    longitude >= southWest.lng &&
    longitude <= northEast.lng &&
    latitude >= southWest.lat &&
    latitude <= northEast.lat
  );
}

function renderMapLibre(container, fc, userPos, onPointClick, options = {}) {
  const maplibregl = window.maplibregl;
  if (!maplibregl) throw new Error('MapLibre is unavailable');
  if (activeMap) {
    try {
      activeMap.remove();
    } catch {}
    activeMap = null;
  }
  clearAllLabels();
  container.replaceChildren();
  const terrainMode = options.terrainMode === '3d' ? '3d' : 'hillshade';
  const camera = options.cameraState || null;
  const map = new maplibregl.Map({
    container,
    style: baseStyle(options.offlineMap, options.terrain, { terrainMode }),
    center: camera?.center || [37.6, 55.75],
    zoom: Number.isFinite(camera?.zoom) ? camera.zoom : 5,
    bearing: Number.isFinite(camera?.bearing) ? camera.bearing : terrainMode === '3d' ? -18 : 0,
    pitch: Number.isFinite(camera?.pitch) ? camera.pitch : terrainMode === '3d' ? 70 : 0,
    attributionControl: true,
    cooperativeGestures: false,
    maxPitch: 85,
    ...(options.offlineMap?.ready
      ? {
          // Finish loading coarser local tiles while zooming so they can cover the
          // viewport until the new detail level is ready. Above the downloaded
          // maxzoom, reuse those tiles instead of repeatedly slicing them in workers.
          cancelPendingTileRequestsWhileZooming: false,
          zoomLevelsToOverscale: undefined,
        }
      : {}),
    ...offlineViewportOptions(options.offlineMap),
  });
  activeMap = map;
  map.on('error', e => {
    const msg = e?.error?.message || e?.message || 'MapLibre error';
    options.onMapError?.(msg);
    console.warn('MapLibre map error', e);
  });
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
    'top-right',
  );
  const bounds = expandBounds(geometryBounds(fc), userPos);
  const { lines, yandexLines, polygons, points } = splitFeatures(fc);
  map.on('style.load', () => {
    applyOfflineViewportConstraints(map, options.offlineMap);
    if (options.terrain?.ready)
      map.addControl(
        new TerrainModeControl({
          initialMode: terrainMode,
          onModeChange: nextMode => {
            if (!applyTerrainMode(map, nextMode))
              throw new Error('Не удалось переключить режим рельефа.');
          },
        }),
        'top-right',
      );
    map.addSource('rfm-lines', { type: 'geojson', data: lines });
    map.addLayer({
      id: 'rfm-lines-casing',
      type: 'line',
      source: 'rfm-lines',
      minzoom: 0,
      maxzoom: 24,
      paint: {
        'line-color': '#111318',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 6, 12, 9, 17, 13],
        'line-opacity': 0.78,
      },
    });
    map.addLayer({
      id: 'rfm-lines',
      type: 'line',
      source: 'rfm-lines',
      minzoom: 0,
      maxzoom: 24,
      paint: {
        'line-color': BRAND_ORANGE,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 12, 6, 17, 9],
        'line-opacity': 1,
      },
    });

    map.addSource('rfm-yandex-lines', { type: 'geojson', data: yandexLines });
    map.addLayer({
      id: 'rfm-yandex-lines-casing',
      type: 'line',
      source: 'rfm-yandex-lines',
      minzoom: 0,
      maxzoom: 24,
      paint: {
        'line-color': '#111318',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 7, 12, 10, 17, 14],
        'line-opacity': 0.82,
      },
    });
    map.addLayer({
      id: 'rfm-yandex-lines',
      type: 'line',
      source: 'rfm-yandex-lines',
      minzoom: 0,
      maxzoom: 24,
      paint: {
        'line-color': BRAND_ORANGE,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 7, 17, 10],
        'line-opacity': 1,
      },
    });
    installRouteDirectionPatterns(map);

    map.addSource('rfm-selected-stage', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'rfm-selected-stage-casing',
      type: 'line',
      source: 'rfm-selected-stage',
      minzoom: 0,
      maxzoom: 24,
      paint: {
        'line-color': '#f8fafc',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 14, 17, 18],
        'line-opacity': 0.92,
      },
    });
    map.addLayer({
      id: 'rfm-selected-stage',
      type: 'line',
      source: 'rfm-selected-stage',
      minzoom: 0,
      maxzoom: 24,
      paint: {
        'line-color': sourceColorExpression(),
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 5, 12, 8, 17, 12],
        'line-opacity': 1,
      },
    });

    map.addSource('rfm-polygons', { type: 'geojson', data: polygons });
    map.addLayer({
      id: 'rfm-polygons-fill',
      type: 'fill',
      source: 'rfm-polygons',
      paint: { 'fill-color': sourceColorExpression(), 'fill-opacity': 0.14 },
    });
    map.addLayer({
      id: 'rfm-polygons-outline',
      type: 'line',
      source: 'rfm-polygons',
      paint: { 'line-color': sourceColorExpression(), 'line-width': 3 },
    });

    map.addSource('rfm-points', { type: 'geojson', data: points });
    map.addLayer({
      id: 'rfm-points',
      type: 'circle',
      source: 'rfm-points',
      minzoom: 0,
      maxzoom: 24,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 12, 8, 17, 11],
        'circle-color': [
          'case',
          ['==', ['slice', ['to-string', ['coalesce', ['get', 'kind'], '']], 0, 7], 'yandex-'],
          BRAND_ORANGE,
          '#f3f5f7',
        ],
        'circle-stroke-color': '#111318',
        'circle-stroke-width': 3,
        'circle-opacity': 1,
      },
    });

    if (userPos && Number.isFinite(userPos.longitude) && Number.isFinite(userPos.latitude)) {
      const user = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [userPos.longitude, userPos.latitude] },
          },
        ],
      };
      map.addSource('user-position', { type: 'geojson', data: user });
      map.addLayer({
        id: 'user-halo',
        type: 'circle',
        source: 'user-position',
        paint: { 'circle-radius': 18, 'circle-color': '#4da3ff', 'circle-opacity': 0.22 },
      });
      map.addLayer({
        id: 'user-dot',
        type: 'circle',
        source: 'user-position',
        paint: {
          'circle-radius': 7,
          'circle-color': '#4da3ff',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      });
    }

    if (bounds && !camera)
      map.fitBounds(
        [
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat],
        ],
        { padding: 48, maxZoom: 15, duration: 0 },
      );

    installRacePointLabels(map, points, onPointClick, {
      alwaysVisible: Boolean(options.offlineMap?.ready),
    });
    installBasemapInspector(map, options.offlineMap);

    if (options.onRouteClick) {
      for (const layerId of ['rfm-lines', 'rfm-yandex-lines']) {
        map.on('click', layerId, e => {
          const feature = e.features?.[0];
          if (feature) options.onRouteClick(routePayload(feature));
        });
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    }

    if (onPointClick) {
      map.on('click', 'rfm-points', e => {
        const f = e.features?.[0];
        if (f) onPointClick(pointPayload(f));
      });
      map.on('mouseenter', 'rfm-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'rfm-points', () => {
        map.getCanvas().style.cursor = '';
      });
    }
  });
  return map;
}

export function updateLiveUserPosition(position, { center = false } = {}) {
  if (!activeMap || !position) return false;
  const longitude = Number(position.longitude);
  const latitude = Number(position.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;

  const data = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { accuracy: Number(position.accuracy) || null },
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
      },
    ],
  };

  try {
    const source = activeMap.getSource?.('user-position');
    if (source?.setData) {
      source.setData(data);
    } else if (activeMap.isStyleLoaded?.()) {
      activeMap.addSource('user-position', { type: 'geojson', data });
      activeMap.addLayer({
        id: 'user-halo',
        type: 'circle',
        source: 'user-position',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 10, 14, 20],
          'circle-color': '#4da3ff',
          'circle-opacity': 0.22,
        },
      });
      activeMap.addLayer({
        id: 'user-dot',
        type: 'circle',
        source: 'user-position',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 14, 8],
          'circle-color': '#4da3ff',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      });
    }
    if (center && isPositionWithinMapBounds(activeMap, longitude, latitude))
      activeMap.easeTo({
        center: [longitude, latitude],
        zoom: Math.max(activeMap.getZoom?.() || 0, 13),
        duration: 700,
      });
    return true;
  } catch (e) {
    console.warn('live user position update failed', e);
    return false;
  }
}

export function renderMap(container, fc, userPos = null, onPointClick = null, options = {}) {
  if (!window.maplibregl) throw new Error('MapLibre is unavailable');
  try {
    return renderMapLibre(container, fc, userPos, onPointClick, options);
  } catch (error) {
    options.onMapError?.(error?.message || String(error));
    throw error;
  }
}

export function selectStageOnMap(stage, { fit = false } = {}) {
  if (!activeMap || !stage?.geometry) return false;
  try {
    const feature = {
      type: 'Feature',
      properties: { ...(stage.geometryFeature?.properties || {}), name: stage.name || 'СУ' },
      geometry: stage.geometry,
    };
    activeMap
      .getSource?.('rfm-selected-stage')
      ?.setData?.({ type: 'FeatureCollection', features: [feature] });
    if (fit) {
      const bounds = geometryBounds({ type: 'FeatureCollection', features: [feature] });
      if (bounds)
        activeMap.fitBounds(
          [
            [bounds.minLon, bounds.minLat],
            [bounds.maxLon, bounds.maxLat],
          ],
          { padding: 64, maxZoom: 15, duration: 550 },
        );
    }
    return true;
  } catch (error) {
    console.warn('stage map selection failed', error);
    return false;
  }
}

export function clearStageOnMap() {
  if (!activeMap) return false;
  try {
    activeMap
      .getSource?.('rfm-selected-stage')
      ?.setData?.({ type: 'FeatureCollection', features: [] });
    return true;
  } catch {
    return false;
  }
}

export function resizeActiveMap() {
  try {
    activeMap?.resize?.();
    return Boolean(activeMap);
  } catch {
    return false;
  }
}
