import {
  registerOfflineMapProtocol,
  offlineVectorSource,
  resetOfflineMapDiagnostics,
} from '../../../../offline-map.js';
import { terrainStyleParts } from '../../../../map/terrain.js';
import { offlineBasemapLayers } from './offline-layers.js';

export function baseStyle(offlineMap, terrain, { terrainMode = 'hillshade' } = {}) {
  const sources = {};
  const layers = [
    { id: 'background', type: 'background', paint: { 'background-color': '#11151b' } },
  ];
  let labelLayers = [];

  if (offlineMap?.ready) {
    registerOfflineMapProtocol();
    resetOfflineMapDiagnostics();
    sources['offline-base'] = offlineVectorSource(offlineMap.raceId, offlineMap);
    const basemapLayers = offlineBasemapLayers('offline-base', offlineMap);
    const firstLabel = basemapLayers.findIndex(layer => layer.type === 'symbol');
    if (firstLabel >= 0) {
      layers.push(...basemapLayers.slice(0, firstLabel));
      labelLayers = basemapLayers.slice(firstLabel);
    } else {
      layers.push(...basemapLayers);
    }
  } else if (navigator.onLine) {
    sources.osm = {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    };
    layers.push({ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.92 } });
  }

  const terrainParts = terrainStyleParts(terrain, terrainMode);
  Object.assign(sources, terrainParts.sources);
  layers.push(...terrainParts.layers, ...labelLayers);
  const style = { version: 8, sources, layers };
  if (terrainParts.terrain) style.terrain = terrainParts.terrain;
  return style;
}
