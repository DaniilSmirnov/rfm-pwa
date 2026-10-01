import { raceWithinWeek, pickDefaultRace } from './catalog-dates.js';

export function chooseVisiblePackages(packages, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (q)
    return packages.filter(p =>
      [
        p.name,
        p.summary?.stage,
        p.summary?.dates,
        p.summary?.city,
        p.summary?.category,
        p.summary?.status,
      ].some(v =>
        String(v || '')
          .toLowerCase()
          .includes(q),
      ),
    );
  const near = pickDefaultRace(packages.filter(raceWithinWeek));
  return near ? [near] : packages[0] ? [packages[0]] : [];
}
