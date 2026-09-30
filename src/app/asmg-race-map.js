const TEMPORARY_ASMG_RACE_IDS = [
  { match: /сортавал|sortaval/i, id: '55' },
  { match: /альмет|almet/i, id: '56' },
  { match: /браслав|braslav/i, id: '57' },
];

export function asmgRaceIdForPackage(pkg) {
  const raceName = [
    pkg?.name,
    pkg?.title,
    pkg?.original?.name,
    pkg?.original?.title,
  ]
    .filter(Boolean)
    .join(' ');

  const mapped = TEMPORARY_ASMG_RACE_IDS.find(item => item.match.test(raceName));
  if (mapped) return mapped.id;

  const existing = pkg?.asmgRaceId ?? pkg?.original?.asmg_id ?? pkg?.original?.asmgId;
  return existing == null ? '' : String(existing);
}
