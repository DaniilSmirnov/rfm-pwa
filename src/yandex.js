export const YANDEX_IMPORT_URL = '/api/yandex/constructor';

export function extractYandexEmbedUrl(embed) {
  if (!embed || typeof embed !== 'string') return null;
  const m = embed.match(/<iframe[^>]+src=["']([^"']+)["']/i) || embed.match(/https:\/\/yandex\.ru\/map-widget\/v1\/\?[^\s"'<>]+/i);
  if (!m) return null;
  const raw = m[1] || m[0];
  try {
    const url = new URL(raw.replace(/&amp;/g, '&'), location.origin);
    if (!['yandex.ru','www.yandex.ru'].includes(url.hostname)) return null;
    if (!url.pathname.startsWith('/map-widget/v1/')) return null;
    return url.toString();
  } catch { return null; }
}

export async function fetchYandexConstructorFeatures(embed) {
  const url = extractYandexEmbedUrl(embed);
  if (!url) throw new Error('В карточке гонки не найдена ссылка Yandex Constructor');
  const r = await fetch(`${YANDEX_IMPORT_URL}?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`${r.status} ${text.slice(0,160)}`); }
  if (!r.ok || !data.ok) throw new Error(data.error || `Yandex import ${r.status}`);
  return data;
}

function cleanProps(f) {
  return {
    kind: f.type === 'placemark' ? 'yandex-point' : `yandex-${f.type || 'object'}`,
    source: 'yandex-constructor',
    name: f.title || f.caption || f.subtitle || (f.type === 'line' ? 'Маршрут' : 'Точка Yandex'),
    title: f.title || '',
    subtitle: f.subtitle || '',
    caption: f.caption || '',
    color: f.stroke?.color || null,
    icon: f.content?.name || null,
    zIndex: f.zIndex ?? null,
  };
}

export function yandexFeaturesToGeoJson(features = []) {
  const out = [];
  for (const f of Array.isArray(features) ? features : []) {
    if (!f || typeof f !== 'object') continue;
    if (f.type === 'placemark' && Array.isArray(f.coordinates) && f.coordinates.length >= 2) {
      const [lon, lat] = f.coordinates.map(Number);
      if (Number.isFinite(lon) && Number.isFinite(lat)) out.push({
        type:'Feature', properties: cleanProps(f), geometry:{ type:'Point', coordinates:[lon,lat] }
      });
      continue;
    }
    const g = f.geometry;
    if (g && ['LineString','MultiLineString','Polygon','MultiPolygon'].includes(g.type) && Array.isArray(g.coordinates)) {
      out.push({ type:'Feature', properties:cleanProps(f), geometry:{ type:g.type, coordinates:g.coordinates } });
    }
  }
  return { type:'FeatureCollection', features:out };
}

export function mergeGeoJson(...collections) {
  return { type:'FeatureCollection', features:collections.flatMap(fc => Array.isArray(fc?.features) ? fc.features : []) };
}
