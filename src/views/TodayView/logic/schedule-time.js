export function raceYearHint(pkg) {
  const raw = String(pkg?.summary?.dates || pkg?.original?.dates || pkg?.original?.date_race || '');
  const m = raw.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

const RACE_REGION_TIMEZONES = [
  [/хабаровск/i, 'Asia/Vladivostok'],
  [/пермск/i, 'Asia/Yekaterinburg'],
  [/свердловск/i, 'Asia/Yekaterinburg'],
  [/тюменск/i, 'Asia/Yekaterinburg'],
  [/челябинск/i, 'Asia/Yekaterinburg'],
  [/кировск/i, 'Europe/Kirov'],
  [/карачаево-?черкес/i, 'Europe/Moscow'],
  [/краснодар/i, 'Europe/Moscow'],
  [/карели/i, 'Europe/Moscow'],
  [/ленинград/i, 'Europe/Moscow'],
  [/московск/i, 'Europe/Moscow'],
  [/новгород/i, 'Europe/Moscow'],
  [/псков/i, 'Europe/Moscow'],
  [/татарстан/i, 'Europe/Moscow'],
  [/ростов/i, 'Europe/Moscow'],
  [/ярослав/i, 'Europe/Moscow'],
];

export function validTimeZone(value) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: String(value) }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function raceTimezone(pkg) {
  const explicit = [
    pkg?.timezone,
    pkg?.original?.timezone,
    pkg?.original?.time_zone,
    pkg?.original?.timezone_name,
    pkg?.original?.tz,
  ].find(validTimeZone);
  if (explicit) return String(explicit);

  const region = String(pkg?.original?.city_race || '');
  const match = RACE_REGION_TIMEZONES.find(([re]) => re.test(region));
  if (match) return match[1];

  // Current RallyFans data is Russia-focused and the upstream API does not
  // expose a timezone field. Moscow time is the safest fallback for unknown regions.
  return 'Europe/Moscow';
}

export function zonedLocalDate(year, month, day, hour, minute, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    return null;
  }

  const partsAt = timestamp =>
    Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, part.value]),
    );

  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = partsAt(guess);
    const represented = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
      0,
    );
    const offset = represented - guess;
    const next = wall - offset;
    if (next === guess) break;
    guess = next;
  }

  const p = partsAt(guess);
  if (
    Number(p.year) !== year ||
    Number(p.month) !== month ||
    Number(p.day) !== day ||
    Number(p.hour) !== hour ||
    Number(p.minute) !== minute
  )
    return null;
  return new Date(guess);
}

const RUSSIAN_MONTHS = {
  янв: 1,
  январ: 1,
  фев: 2,
  феврал: 2,
  мар: 3,
  март: 3,
  апр: 4,
  апрел: 4,
  май: 5,
  мая: 5,
  июн: 6,
  июнь: 6,
  июня: 6,
  июл: 7,
  июль: 7,
  июля: 7,
  авг: 8,
  август: 8,
  сен: 9,
  сент: 9,
  сентябр: 9,
  окт: 10,
  октябр: 10,
  ноя: 11,
  ноябр: 11,
  дек: 12,
  декабр: 12,
};

export function textualMonth(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^а-я]/g, '');
  for (const [prefix, month] of Object.entries(RUSSIAN_MONTHS)) {
    if (normalized.startsWith(prefix)) return month;
  }
  return null;
}

export function parseScheduleDateTime(dateText, timeText, pkg) {
  const time = String(timeText || '').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!time) return null;

  const raw = String(dateText || '').trim();
  let day, month, year;
  let d = raw.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
  if (d) {
    day = Number(d[1]);
    month = Number(d[2]);
    year = Number(d[3]);
  } else {
    d = raw.match(/\b(\d{1,2})[.\/-](\d{1,2})\b/);
    if (d) {
      day = Number(d[1]);
      month = Number(d[2]);
      year = raceYearHint(pkg);
    } else {
      d = raw.match(/\b(\d{1,2})\s+([А-Яа-яЁё.]+)/);
      if (!d) return null;
      day = Number(d[1]);
      month = textualMonth(d[2]);
      year = raceYearHint(pkg);
      if (!month) return null;
    }
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return zonedLocalDate(year, month, day, Number(time[1]), Number(time[2]), raceTimezone(pkg));
}
