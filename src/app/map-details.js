import { buildStageDescriptors } from './schedule.js';

const scalar = value => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
};

export function stageMapStatuses(pkg) {
  return buildStageDescriptors(pkg).map(stage => {
    const change = [...stage.events]
      .reverse()
      .find(event => event.kind === 'open' || event.kind === 'close');
    return {
      ...stage,
      mapStatus:
        change?.kind === 'close'
          ? 'Закрыт'
          : change?.kind === 'open'
            ? 'Открыт'
            : 'Статус не опубликован',
      mapStatusKind: change?.kind || 'unknown',
    };
  });
}

function safeMediaUrl(value) {
  const raw = scalar(value);
  if (!raw) return '';
  try {
    const base = typeof window === 'undefined' ? 'https://localhost' : window.location.origin;
    const url = new URL(raw, base);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function pointFeatureDetails(pkg, point) {
  const features = pkg?.geojson?.features || [];
  const feature = features.find(candidate => {
    const coordinates = candidate?.geometry?.coordinates;
    if (candidate?.geometry?.type !== 'Point' || !Array.isArray(coordinates)) return false;
    const [lon, lat] = coordinates.map(Number);
    return (
      Math.abs(lat - Number(point?.lat)) < 0.00001 && Math.abs(lon - Number(point?.lon)) < 0.00001
    );
  });
  const properties = feature?.properties || {};
  const photoValue = Object.entries(properties).find(
    ([key, value]) =>
      /photo|image|фото|изображ/i.test(key) &&
      (scalar(value) || (Array.isArray(value) && scalar(value[0]))),
  )?.[1];
  const photo = safeMediaUrl(Array.isArray(photoValue) ? photoValue[0] : photoValue);
  const valueFor = pattern => {
    for (const [key, value] of Object.entries(properties)) {
      if (pattern.test(key)) {
        const text = scalar(value);
        if (text) return text;
      }
    }
    return '';
  };
  return {
    feature: feature || null,
    photo,
    parking: valueFor(/parking|парков/i),
    walking: valueFor(/walking|walk|пеш|ходьб/i),
  };
}
