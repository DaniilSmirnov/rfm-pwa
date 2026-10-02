const TIME_FIELDS = [
  'road_closes_at',
  'first_zero_at',
  'first_crew_at',
  'last_crew_at',
  'road_opens_at',
];

export function isSortavalaRace(race) {
  const text = [
    race?.name,
    race?.city,
    race?.city_race,
    race?.city_race_details,
    race?.summary?.city,
    race?.original?.name,
    race?.original?.city_race,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е');
  return /сортавал|sortavala|белые\s+ночи/.test(text);
}

export function validateOverlapSchedule(value) {
  if (!value || !Array.isArray(value.stages) || value.stages.length === 0) {
    throw new TypeError('JSON графика перекрытий должен содержать непустой массив stages.');
  }
  for (const [index, stage] of value.stages.entries()) {
    if (!stage || !Number.isFinite(Number(stage.number)) || !stage.name) {
      throw new TypeError(`Некорректное описание СУ в stages[${index}].`);
    }
    for (const field of TIME_FIELDS) {
      if (stage[field] && !/^\d{2}:\d{2}$/.test(stage[field])) {
        throw new TypeError(`Некорректное время ${field} в stages[${index}].`);
      }
    }
  }
  return value;
}

// API contract placeholder: GET /api/races/:raceId/overlap-schedule returns the JSON shape
// validated above. The endpoint can be swapped without changing chart rendering.
export async function downloadOverlapSchedule(
  raceId,
  { fetchImpl = fetch, baseUrl = '/api/races' } = {},
) {
  const response = await fetchImpl(`${baseUrl}/${encodeURIComponent(raceId)}/overlap-schedule`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Не удалось загрузить график перекрытий (${response.status}).`);
  return validateOverlapSchedule(await response.json());
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || '')
    .split(':')
    .map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}
