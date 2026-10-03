import { parseScheduleDateTime, raceTimezone } from '../../../app/schedule.js';

const DATE_RE = /\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/g;

const asArray = value =>
  Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];

export function raceDateKeys(pkg) {
  const dates = String(pkg?.original?.dates || pkg?.summary?.dates || '').match(DATE_RE) || [];
  const scheduleDates = asArray(pkg?.original?.schedule)
    .map(item => parseScheduleDateTime(item?.date, '12:00', pkg))
    .filter(Boolean)
    .map(date => calendarKey(date, pkg));
  const keys = dates
    .map(date => parseScheduleDateTime(date, '12:00', pkg))
    .filter(Boolean)
    .map(date => calendarKey(date, pkg));
  return [...new Set([...keys, ...scheduleDates])].sort();
}

export function calendarKey(date, pkg) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: raceTimezone(pkg),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getTodayState(pkg, now = new Date()) {
  if (!pkg) return { state: 'before', timezone: raceTimezone(pkg), raceDay: '', finishDay: '' };
  const keys = raceDateKeys(pkg);
  const today = calendarKey(now, pkg);
  const raceDay = keys[0] || '';
  const finishDay = keys.at(-1) || raceDay;
  const status = String(pkg?.original?.status_race || pkg?.summary?.status || '').toLowerCase();
  const publishedFinished = /заверш|оконч|состоял|прош|finished|completed|\bover\b/.test(status);
  if (!keys.length || today < raceDay) return { state: 'before', timezone: raceTimezone(pkg), raceDay, finishDay };
  if (today > finishDay) return { state: 'after-finish', timezone: raceTimezone(pkg), raceDay, finishDay };
  if (today === finishDay && publishedFinished) {
    return { state: 'finished-today', timezone: raceTimezone(pkg), raceDay, finishDay };
  }
  return { state: 'running', timezone: raceTimezone(pkg), raceDay, finishDay };
}
