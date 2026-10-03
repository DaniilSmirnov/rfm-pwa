import { parseScheduleDateTime, raceTimezone } from '../../../app/schedule.js';

const DATE_RE = /\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/g;
const asArray = value =>
  Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];

export function raceDateKeys(pkg) {
  const dates =
    String(pkg?.original?.dates || pkg?.summary?.dates || pkg?.dates || '').match(DATE_RE) || [];
  const scheduleDates = asArray(pkg?.original?.schedule || pkg?.schedule)
    .map(item => parseScheduleDateTime(item?.date, '12:00', pkg))
    .filter(Boolean)
    .map(date => calendarKey(date, pkg));
  const directKeys = dates
    .map(value => value.match(/(\\d{1,2})[.\\/-](\\d{1,2})[.\\/-](\\d{4})/))
    .filter(Boolean)
    .map(([, day, month, year]) => `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  const keys = dates
    .map(date => parseScheduleDateTime(date, '12:00', pkg) || new Date(date))
    .filter(date => date instanceof Date && !Number.isNaN(date.getTime()))
    .map(date => calendarKey(date, pkg));
  if (!keys.length) {
    const fallback = String(pkg?.original?.dates || pkg?.summary?.dates || pkg?.dates || '')
      .split(/\\s+[–—-]\\s+|\\s+to\\s+/i)
      .map(value => new Date(value.trim()))
      .filter(date => !Number.isNaN(date.getTime()))
      .map(date => calendarKey(date, pkg));
    keys.push(...fallback);
  }
  return [...new Set([...directKeys, ...keys, ...scheduleDates])].sort();
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

export function hasFinalProtocol(pkg) {
  return Boolean(
    pkg?.finalProtocol ||
      pkg?.original?.finalProtocol ||
      pkg?.original?.final_protocol ||
      pkg?.crewResults?.final ||
      pkg?.crewResults?.isFinal,
  );
}

export function getTodayState(pkg, now = new Date()) {
  const timezone = raceTimezone(pkg);
  if (!pkg) return { state: 'before', timezone, raceDay: '', finishDay: '' };
  const keys = raceDateKeys(pkg);
  const today = calendarKey(now, pkg);
  const raceDay = keys[0] || '';
  const finishDay = keys.at(-1) || raceDay;
  if (!keys.length || today < raceDay) return { state: 'before', timezone, raceDay, finishDay };
  if (today > finishDay) return { state: 'after-finish', timezone, raceDay, finishDay };
  if (today === finishDay && hasFinalProtocol(pkg)) {
    return { state: 'finished-today', timezone, raceDay, finishDay };
  }
  return { state: 'running', timezone, raceDay, finishDay };
}
