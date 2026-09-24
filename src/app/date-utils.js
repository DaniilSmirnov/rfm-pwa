export function startOfLocalDay(date=new Date()){ return new Date(date.getFullYear(),date.getMonth(),date.getDate()); }
export function parseDdMmYyyy(value){
  const m=String(value||'').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if(!m) return null;
  const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  return Number.isNaN(d.getTime())?null:d;
}
export function raceDateRange(race){
  const raw=String(race?.dates||race?.summary?.dates||race?.date_race||'').trim();
  const matches=[...raw.matchAll(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/g)];
  if(matches.length){
    const dates=matches.map(m=>new Date(Number(m[3]),Number(m[2])-1,Number(m[1]))).filter(d=>!Number.isNaN(d.getTime()));
    if(dates.length) return {start:dates[0],end:dates[dates.length-1]};
  }
  const single=parseDdMmYyyy(raw);
  return single?{start:single,end:single}:null;
}
export function distanceFromTodayDays(race,now=new Date()){
  const range=raceDateRange(race); if(!range) return Infinity;
  const today=startOfLocalDay(now);
  const start=startOfLocalDay(range.start),end=startOfLocalDay(range.end);
  if(today>=start&&today<=end) return 0;
  const target=today<start?start:end;
  return Math.abs(target-today)/86400000;
}
export function raceWithinWeek(race,now=new Date()){ return distanceFromTodayDays(race,now)<=7; }
export function pickDefaultRace(rows,now=new Date()){
  const dated=rows.filter(r=>Number.isFinite(distanceFromTodayDays(r,now)));
  if(!dated.length) return null;
  return dated.slice().sort((a,b)=>distanceFromTodayDays(a,now)-distanceFromTodayDays(b,now))[0]||null;
}
export function raceYearHint(pkg,now=new Date()){
  const raw=String(pkg?.summary?.dates||pkg?.original?.dates||pkg?.original?.date_race||'');
  const m=raw.match(/\b(20\d{2})\b/);
  return m?Number(m[1]):now.getFullYear();
}
export const RACE_REGION_TIMEZONES=[
  [/хабаровск/i,'Asia/Vladivostok'],[/пермск/i,'Asia/Yekaterinburg'],[/свердловск/i,'Asia/Yekaterinburg'],
  [/тюменск/i,'Asia/Yekaterinburg'],[/челябинск/i,'Asia/Yekaterinburg'],[/кировск/i,'Europe/Kirov'],
  [/карачаево-?черкес/i,'Europe/Moscow'],[/краснодар/i,'Europe/Moscow'],[/карели/i,'Europe/Moscow'],
  [/ленинград/i,'Europe/Moscow'],[/московск/i,'Europe/Moscow'],[/новгород/i,'Europe/Moscow'],
  [/псков/i,'Europe/Moscow'],[/татарстан/i,'Europe/Moscow'],[/ростов/i,'Europe/Moscow'],[/ярослав/i,'Europe/Moscow']
];
export function validTimeZone(value){
  if(!value) return false;
  try{ new Intl.DateTimeFormat('en',{timeZone:String(value)}).format(new Date()); return true; }catch{return false;}
}
export function raceTimezone(pkg){
  const explicit=[pkg?.timezone,pkg?.original?.timezone,pkg?.original?.time_zone,pkg?.original?.timezone_name,pkg?.original?.tz].find(validTimeZone);
  if(explicit) return String(explicit);
  const region=String(pkg?.original?.city_race||'');
  return RACE_REGION_TIMEZONES.find(([re])=>re.test(region))?.[1]||'Europe/Moscow';
}
export function zonedLocalDate(year,month,day,hour,minute,timeZone){
  const wall=Date.UTC(year,month-1,day,hour,minute,0,0);
  let formatter;
  try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}catch{return null;}
  const partsAt=timestamp=>Object.fromEntries(formatter.formatToParts(new Date(timestamp)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  let guess=wall;
  for(let i=0;i<3;i++){
    const p=partsAt(guess);
    const represented=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second),0);
    const next=wall-(represented-guess);
    if(next===guess) break;
    guess=next;
  }
  const p=partsAt(guess);
  if(Number(p.year)!==year||Number(p.month)!==month||Number(p.day)!==day||Number(p.hour)!==hour||Number(p.minute)!==minute) return null;
  return new Date(guess);
}
export const RUSSIAN_MONTHS={'янв':1,'январ':1,'фев':2,'феврал':2,'мар':3,'март':3,'апр':4,'апрел':4,'май':5,'мая':5,'июн':6,'июнь':6,'июня':6,'июл':7,'июль':7,'июля':7,'авг':8,'август':8,'сен':9,'сент':9,'сентябр':9,'окт':10,'октябр':10,'ноя':11,'ноябр':11,'дек':12,'декабр':12};
export function textualMonth(value){
  const normalized=String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-я]/g,'');
  for(const [prefix,month] of Object.entries(RUSSIAN_MONTHS)) if(normalized.startsWith(prefix)) return month;
  return null;
}
export function parseScheduleDateTime(dateText,timeText,pkg){
  const time=String(timeText||'').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/); if(!time) return null;
  const raw=String(dateText||'').trim(); let day,month,year;
  let d=raw.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
  if(d){day=Number(d[1]);month=Number(d[2]);year=Number(d[3]);}
  else if((d=raw.match(/\b(\d{1,2})[.\/-](\d{1,2})\b/))){day=Number(d[1]);month=Number(d[2]);year=raceYearHint(pkg);}
  else if((d=raw.match(/\b(\d{1,2})\s+([А-Яа-яЁё.]+)/))){day=Number(d[1]);month=textualMonth(d[2]);year=raceYearHint(pkg);if(!month)return null;}
  else return null;
  if(day<1||day>31||month<1||month>12) return null;
  return zonedLocalDate(year,month,day,Number(time[1]),Number(time[2]),raceTimezone(pkg));
}
