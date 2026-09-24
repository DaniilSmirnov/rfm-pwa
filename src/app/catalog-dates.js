export function startOfLocalDay(date=new Date()) {
  return new Date(date.getFullYear(),date.getMonth(),date.getDate());
}

export function parseDdMmYyyy(value) {
  const m=String(value||'').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if(!m) return null;
  const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  return Number.isNaN(d.getTime())?null:d;
}

export function raceDateRange(race) {
  const raw=String(race?.dates || race?.summary?.dates || race?.date_race || '').trim();
  const matches=[...raw.matchAll(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/g)];
  if(matches.length){
    const dates=matches.map(m=>new Date(Number(m[3]),Number(m[2])-1,Number(m[1]))).filter(d=>!Number.isNaN(d.getTime()));
    if(dates.length) return {start:dates[0],end:dates[dates.length-1]};
  }
  const single=parseDdMmYyyy(raw);
  return single?{start:single,end:single}:null;
}

export function distanceFromTodayDays(race) {
  const range=raceDateRange(race); if(!range) return Infinity;
  const today=startOfLocalDay();
  const start=startOfLocalDay(range.start), end=startOfLocalDay(range.end);
  if(today>=start && today<=end) return 0;
  const target=today<start?start:end;
  return Math.abs(target-today)/86400000;
}

export function raceWithinWeek(race){ return distanceFromTodayDays(race)<=7; }

export function pickDefaultRace(rows) {
  const dated=rows.filter(r=>Number.isFinite(distanceFromTodayDays(r)));
  if(!dated.length) return null;
  return dated.slice().sort((a,b)=>distanceFromTodayDays(a)-distanceFromTodayDays(b))[0] || null;
}
