import {
  buildStageDescriptors,
  normalizeStageKey,
  parseScheduleDateTime,
  raceTimezone,
  stageIdentity,
} from './schedule.js';

const scalar = value => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
};
const asArray = value =>
  Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const resultStageKey = stage =>
  stageIdentity({ location: stage?.specialStage?.name })?.key ||
  normalizeStageKey(stage?.specialStage?.name);

export function stageMapStatuses(pkg) {
  return buildStageDescriptors(pkg).map(stage => {
    const stateFor = event => {
      const text = `${event.text} ${event.status}`.toLocaleLowerCase('ru');
      return /live|ид[её]т|в эфире|актив/.test(text)
        ? { label: 'LIVE', kind: 'live' }
        : /заверш|оконч|состоял|finished|completed/.test(text)
          ? { label: 'Завершён', kind: 'completed' }
          : /измен[её]н|перенес[её]н|новое время|корректировк/.test(text)
            ? { label: 'Изменён', kind: 'changed' }
            : /expected|ожида|заплан|по расписанию|по графику/.test(text)
              ? { label: 'Ожидается', kind: 'expected' }
              : null;
    };
    const state = stage.events.slice().reverse().map(stateFor).find(Boolean) || null;
    const change = [...stage.events]
      .reverse()
      .find(event => event.kind === 'open' || event.kind === 'close');
    return {
      ...stage,
      mapStatus:
        state?.label ||
        (change?.kind === 'close'
          ? 'Закрыт'
          : change?.kind === 'open'
            ? 'Открыт'
            : 'Статус не опубликован'),
      mapStatusKind: state?.kind || change?.kind || 'unknown',
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
  const description = valueFor(/description|desc|описан|что увид/i);
  const rating = valueFor(/rating|rating_value|оценк|рейтинг/i);
  return {
    feature: feature || null,
    photo,
    parking: valueFor(/parking|парков/i),
    walking: valueFor(/walking|walk|пеш|ходьб/i),
    description,
    rating,
  };
}

function averageStageSpeed(pkg, stageKey) {
  const stage = asArray(pkg?.crewResults?.eventResults)
    .slice()
    .reverse()
    .find(item => resultStageKey(item) === stageKey);
  const distanceKm = Number(stage?.specialStage?.distance);
  const speeds = asArray(stage?.results)
    .map(result => {
      if (result?.goingOff || result?.goingOffAfterSu) return 0;
      const time = Number(result?.time);
      return distanceKm > 0 && time > 0 ? (distanceKm * 3600000) / time : 0;
    })
    .filter(speed => speed >= 10 && speed <= 200)
    .sort((a, b) => a - b);
  return speeds.length ? speeds[Math.floor(speeds.length / 2)] : null;
}

export function scheduledStageCrews(pkg, stageName, now = new Date(), distanceFromStart = null) {
  const stageKey = normalizeStageKey(stageName);
  if (!stageKey) return [];
  const speedKmh = averageStageSpeed(pkg, stageKey);
  return asArray(pkg?.original?.schedule)
    .flatMap(item => {
      if (stageIdentity(item)?.key !== stageKey) return [];
      const scheduledRows = [
        ...asArray(item?.crews),
        ...asArray(item?.starts),
        ...asArray(item?.events).filter(
          row =>
            row?.crew ||
            row?.crewNumber ||
            (row?.number && /экипаж|crew/i.test(String(row?.text || ''))),
        ),
      ];
      return scheduledRows.map(row => {
        const crew = row?.crew || {};
        const number = row?.crewNumber || row?.number || crew?.number;
        const time = String(row?.time || row?.startTime || '').trim();
        const startsAt = parseScheduleDateTime(item?.date, time, pkg);
        const eta =
          speedKmh && Number.isFinite(Number(distanceFromStart)) && Number(distanceFromStart) >= 0
            ? new Date(
                startsAt?.getTime() + (Number(distanceFromStart) / 1000 / speedKmh) * 3600000,
              )
            : null;
        return {
          id: String(crew?.id || number || crew?.name || row?.crewName || row?.name || ''),
          number: String(number || ''),
          name: (typeof crew === 'string' ? crew : crew?.name) || row?.crewName || row?.name || '',
          time,
          startsAt,
          eta,
        };
      });
    })
    .filter(row => row.id && row.startsAt && (row.eta ? row.eta >= now : row.startsAt >= now))
    .sort((a, b) => (a.eta || a.startsAt) - (b.eta || b.startsAt));
}

export function formatRallyTimeOfDay(value, pkg) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: raceTimezone(pkg),
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function stagePointResults(pkg, stageName) {
  const stageKey = normalizeStageKey(stageName);
  const stage = asArray(pkg?.crewResults?.eventResults).find(
    item => resultStageKey(item) === stageKey,
  );
  if (!stage) return null;
  const finished = asArray(stage.results).filter(
    result => Number(result?.time) > 0 && !result?.goingOff && !result?.goingOffAfterSu,
  );
  return {
    completedCount: finished.length,
    bestResult: finished.slice().sort((a, b) => Number(a.time) - Number(b.time))[0] || null,
  };
}
