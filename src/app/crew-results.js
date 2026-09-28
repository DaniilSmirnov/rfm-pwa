export const crewName = crew =>
  [
    [crew?.pilot?.lastName, crew?.pilot?.firstName].filter(Boolean).join(' '),
    [crew?.navigator?.lastName, crew?.navigator?.firstName].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' / ');
const resultSearchText = result =>
  [
    result?.crew?.number,
    crewName(result?.crew) || `Экипаж № ${result?.crew?.number || '—'}`,
    result?.crew?.car,
    result?.discipline?.name,
  ]
    .join(' ')
    .toLocaleLowerCase('ru');
export async function fetchAsmgResults(asmgRaceId, fetcher = fetch) {
  const id = String(asmgRaceId ?? '').trim();
  if (!/^\d+$/.test(id)) throw new Error('Укажи номер гонки на asmg.ru.');
  const response = await fetcher(`/api/asmg/race/${encodeURIComponent(id)}/results`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`АСМГ ответил с ошибкой (${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data?.eventResults)) throw new Error('АСМГ не вернул таблицу результатов.');
  return data;
}

export function crewResultClasses(results) {
  return [
    ...new Set(
      (Array.isArray(results) ? results : [])
        .map(result => String(result?.discipline?.name || '').trim())
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right, 'ru'));
}

export function filterCrewResultsByClass(results, className = '') {
  const source = Array.isArray(results) ? results : [];
  return className
    ? source.filter(result => String(result?.discipline?.name || '').trim() === className)
    : source;
}

export function visibleCrewResults(
  results,
  query = '',
  { className = '', limitToTopThree = true } = {},
) {
  const source = filterCrewResultsByClass(results, className);
  const normalized = String(query).trim().toLocaleLowerCase('ru');
  const matching = normalized
    ? source.filter(result => resultSearchText(result).includes(normalized))
    : source;
  return !normalized && limitToTopThree ? matching.slice(0, 3) : matching;
}

export function sortCrewResults(results) {
  return (Array.isArray(results) ? results : []).slice().sort((left, right) => {
    const leftRetired = left?.goingOff || left?.goingOffAfterSu ? 1 : 0;
    const rightRetired = right?.goingOff || right?.goingOffAfterSu ? 1 : 0;
    return (
      leftRetired - rightRetired ||
      (Number(left?.time) || Infinity) - (Number(right?.time) || Infinity)
    );
  });
}

function formatRallyTime(milliseconds) {
  const tenths = Math.max(0, Math.round((Number(milliseconds) || 0) / 100));
  const hours = Math.floor(tenths / 36000);
  const minutes = Math.floor((tenths % 36000) / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${tenths % 10}`;
}

export function overallCrewResults(stages) {
  const crews = new Map();
  let distance = 0;
  for (const stage of Array.isArray(stages) ? stages : []) {
    distance += Number(stage?.specialStage?.distance) || 0;
    for (const result of Array.isArray(stage?.results) ? stage.results : []) {
      const crew = result?.crew || {};
      const key = String(crew.id || crew.number || result.id || '');
      if (!key) continue;
      const row = crews.get(key) || {
        crew,
        discipline: result.discipline,
        time: 0,
        timePenalty: 0,
        goingOff: false,
        goingOffAfterSu: false,
        reasonGoingOff: '',
      };
      row.crew = crew;
      row.discipline = result.discipline || row.discipline;
      if (!result.goingOff) {
        row.time += Number(result.time) || 0;
        row.timePenalty += Number(result.timePenalty) || 0;
      }
      if (result.goingOff || result.goingOffAfterSu) {
        row.goingOff = row.goingOff || Boolean(result.goingOff);
        row.goingOffAfterSu = row.goingOffAfterSu || Boolean(result.goingOffAfterSu);
        row.reasonGoingOff = result.reasonGoingOff || row.reasonGoingOff;
      }
      crews.set(key, row);
    }
  }
  const results = [...crews.values()]
    .filter(result => result.time > 0 || result.goingOff)
    .map(result => {
      const time = result.time + result.timePenalty;
      return {
        ...result,
        time,
        formattedTime: formatRallyTime(time),
        formattedTimePenalty: formatRallyTime(result.timePenalty),
        distance,
      };
    });
  const ordered = sortCrewResults(results);
  let leaderTime = null,
    previousTime = null;
  for (const result of ordered) {
    if (result.goingOff) {
      result.formattedFromLeader = '—';
      result.formattedTimeFromPrevious = '—';
      result.speed = 0;
      continue;
    }
    leaderTime ??= result.time;
    result.formattedFromLeader = formatRallyTime(result.time - leaderTime);
    result.formattedTimeFromPrevious = formatRallyTime(
      previousTime == null ? 0 : result.time - previousTime,
    );
    result.speed =
      result.time > 0 ? Math.round(((distance * 3_600_000) / result.time) * 10) / 10 : 0;
    previousTime = result.time;
  }
  return ordered;
}

export function crewResultViews(eventResults) {
  const stages = Array.isArray(eventResults) ? eventResults : [];
  const lastName = stages.at(-1)?.specialStage?.name || 'последнего СУ';
  return [
    { key: 'overall', name: `Общий итог после ${lastName}`, results: overallCrewResults(stages) },
    ...stages.map((stage, index) => ({
      key: String(index),
      name: stage?.specialStage?.name || `Спецучасток ${index + 1}`,
      results: sortCrewResults(
        stage?.results?.filter(
          result => Number(result?.time) > 0 || result?.goingOff || result?.goingOffAfterSu,
        ),
      ),
    })),
  ];
}
