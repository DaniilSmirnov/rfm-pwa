import { semanticBasemapLayers } from './semantic-layers.js';
import { nativeBasemapLabelLayers } from './label-layers.js';

export function offlineBasemapLayers(source = 'offline-base', offlineMap = {}) {
  const metadataLayers = Array.isArray(offlineMap?.vectorLayers)
    ? offlineMap.vectorLayers.map(v => (typeof v === 'string' ? v : v?.id)).filter(Boolean)
    : [];
  const fallback = [
    'earth',
    'landuse',
    'landcover',
    'natural',
    'water',
    'physical_line',
    'buildings',
    'roads',
    'transit',
    'boundaries',
    'places',
    'physical_point',
    'pois',
  ];
  const names = [...new Set(metadataLayers.length ? metadataLayers : fallback)];

  const geometry = names.flatMap((name, i) => semanticBasemapLayers(source, name, i));
  const labels = names.flatMap((name, i) => nativeBasemapLabelLayers(source, name, i));
  return [...geometry, ...labels];
}
