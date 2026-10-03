import { parseScheduleDateTime } from '../../../app/schedule.js';
import { overallCrewResults } from '../../ResultsScreen/logic/crew-results.js';
import { nextUpcomingRace } from './catalog-dates.js';
import { raceHasFinished } from './today-summary.js';

export const asArray = value =>
  Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];

function scheduleMoment(item, event, pkg) {
  return parseScheduleDateTime(item?.date, event?.time || item?.time, pkg);
}

export function explicitStageState(item, event) {
  const value = String(
    item?.status || item?.state || item?.status_race || event?.status || event?.state || '',
  ).toLocaleLowerCase('ru');
  if (/live|ид[её]т|в эфире|актив/.test(value)) return { label: 'LIVE', kind: 'live' };
  if (/заверш|оконч|состоял|прош|finished|completed/.test(value))
    return { label: 'Завершён', kind: 'done' };
  return { label: 'По расписанию', kind: 'planned' };
}

export function nextProgramItem(pkg, now = new Date()) {
  const events = asArray(pkg?.original?.schedule).flatMap(item =>
    asArray(item?.events).map(event => ({
      item,
      event,
      moment: scheduleMoment(item, event, pkg),
    })),
  );
  const liveEvents = events.filter(row => explicitStageState(row.item, row.event).kind === 'live');
  if (liveEvents.length)
    return liveEvents.sort((a, b) => (b.moment?.getTime() || 0) - (a.moment?.getTime() || 0))[0];
  return (
    events
      .filter(row => row.moment && row.moment.getTime() >= now.getTime())
      .sort((a, b) => a.moment - b.moment)[0] || null
  );
}

export function nextScheduledCrew(pkg, now = new Date()) {
  const rows = asArray(pkg?.original?.schedule).flatMap(item => {
    const scheduleRows = [
      ...asArray(item?.crews),
      ...asArray(item?.starts),
      ...asArray(item?.events),
    ];
    return scheduleRows.map(row => ({
      item,
      row,
      moment: scheduleMoment(item, row, pkg),
    }));
  });
  return (
    rows
      .filter(
        ({ row, moment }) =>
          moment && moment >= now && (row?.crew || row?.crewNumber || row?.number),
      )
      .sort((a, b) => a.moment - b.moment)[0] || null
  );
}

export function currentScheduledCrew(pkg) {
  const rows = asArray(pkg?.original?.schedule).flatMap(item =>
    [...asArray(item?.crews), ...asArray(item?.starts), ...asArray(item?.events)].map(row => ({
      item,
      row,
    })),
  );
  return (
    rows.find(
      ({ item, row }) =>
        explicitStageState(item, row).kind === 'live' &&
        (row?.crew || row?.crewNumber || row?.number),
    ) || null
  );
}

export function countdownLabel(pkg, now, fallbackDays) {
  const upcomingStarts = asArray(pkg?.original?.schedule)
    .flatMap(item =>
      asArray(item?.events)
        .filter(event => {
          if (/^(?:race[-_ ]?)?start|first[-_ ]?start$/i.test(String(event?.kind || '')))
            return true;
          const text = `${event?.text || ''} ${event?.kind || ''} ${item?.location || ''}`
            .toLocaleLowerCase('ru')
            .replace(/ё/g, 'е');
          return /перв(?:ый|ого)\s+старт|(?:су|ss)\s*1.*старт|старт.*(?:су|ss)\s*1|официальн(?:ый|ого)\s+старт|начал[оа]\s+(?:ралли|соревнован)|rally\s+start|start\s+(?:ss\s*1|stage\s*1)/i.test(
            text,
          );
        })
        .map(event => scheduleMoment(item, event, pkg))
        .filter(Boolean),
    )
    .filter(moment => moment >= now)
    .sort((a, b) => a - b);
  const start = upcomingStarts[0];
  if (!start) return `До начала примерно ${Math.max(1, Math.round(fallbackDays))} дн.`;
  const remainingHours = Math.max(0, Math.floor((start.getTime() - now.getTime()) / 3600000));
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;
  return `До старта ${days} дн. ${hours} ч.`;
}

export function latestPositionChange(eventResults) {
  if (!Array.isArray(eventResults) || eventResults.length < 2) return null;
  const previous = overallCrewResults(eventResults.slice(0, -1));
  const current = overallCrewResults(eventResults);
  const previousPlaces = new Map(
    previous.map((row, index) => [String(row?.crew?.id || row?.crew?.number || ''), index + 1]),
  );
  return (
    current
      .map((row, index) => {
        const key = String(row?.crew?.id || row?.crew?.number || '');
        const before = previousPlaces.get(key);
        const place = index + 1;
        return before && before !== place
          ? {
              crew: row.crew,
              from: before,
              to: place,
              stage: eventResults.at(-1)?.specialStage?.name,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.from - b.to - (a.from - a.to))[0] || null
  );
}

export function updateSummary(pkg) {
  const update = pkg?.pendingUpdate || pkg?.lastSmartUpdate;
  return update
    ? {
        update,
        changes: asArray(update.changes),
        pending: Boolean(pkg.pendingUpdate),
      }
    : null;
}

export function offlineLabel(app, pkg, id) {
  const saved = app.downloadedIds?.has?.(id);
  const map = Boolean(pkg?.offlineMap?.ready);
  const terrain = Boolean(pkg?.terrain?.ready);
  return {
    saved,
    details: [
      saved ? 'Пакет сохранён' : 'Пакет не сохранён',
      map ? 'карта готова' : 'карта не загружена',
      terrain ? 'рельеф готов' : 'рельеф не загружен',
    ],
  };
}

export function packageRaceId(pkg) {
  return Number(pkg?.raceId || pkg?.original?.id || pkg?.original?.raceId || pkg?.id);
}
export function raceImage(race) {
  return race?.original?.image || race?.image || '';
}
export function overlaps(race) {
  const value = race?.original?.overlap_schedule || race?.overlap_schedule;
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

export function nextRaceDownloadSuggestion(pkg, catalog, now = new Date()) {
  if (!pkg || !raceHasFinished(pkg, now)) return null;
  const next = nextUpcomingRace(catalog, now);
  if (!next) return null;
  return packageRaceId(pkg) === Number(next.id) ? null : next;
}
