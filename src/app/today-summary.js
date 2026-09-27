import { parseScheduleDateTime, raceTimezone } from './schedule.js';

const asArray=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
function calendarKey(date,pkg){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:raceTimezone(pkg),year:'numeric',month:'2-digit',day:'2-digit'
  }).format(date);
}

export function scheduleForDate(pkg,date=new Date()){
  const key=calendarKey(date,pkg);
  return asArray(pkg?.original?.schedule).filter(item=>{
    const parsed=parseScheduleDateTime(item?.date,'12:00',pkg);
    return parsed&&calendarKey(parsed,pkg)===key;
  }).map(item=>({...item,events:asArray(item.events)}));
}

function hasFinished(schedule,pkg,now){
  const moments=schedule.flatMap(item=>asArray(item?.events)
    .map(event=>parseScheduleDateTime(item?.date,event?.time,pkg))
    .filter(Boolean));
  return moments.length>0&&moments.every(moment=>moment.getTime()<=now.getTime());
}

export function raceHasFinished(pkg,now=new Date()){
  const status=String(pkg?.original?.status_race||pkg?.summary?.status||'').toLowerCase();
  if(/заверш|оконч|состоял|прош|finished|completed|\bover\b/.test(status)) return true;
  const schedule=asArray(pkg?.original?.schedule);
  const moments=schedule.flatMap(item=>asArray(item?.events)
    .map(event=>parseScheduleDateTime(item?.date,event?.time,pkg)).filter(Boolean));
  if(moments.length&&moments.every(moment=>moment<=now)) return true;
  const scheduleEnds=schedule.map(item=>parseScheduleDateTime(item?.date,'23:59',pkg)).filter(Boolean);
  if(scheduleEnds.length&&Math.max(...scheduleEnds.map(date=>date.getTime()))<now.getTime()) return true;
  const dates=String(pkg?.original?.dates||pkg?.summary?.dates||'').match(/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/g)||[];
  const raceEnd=dates.at(-1)&&parseScheduleDateTime(dates.at(-1),'23:59',pkg);
  return Boolean(raceEnd&&raceEnd<now);
}

export function todaySummary(pkg,now=new Date()){
  const today=scheduleForDate(pkg,now);
  const [year,month,day]=calendarKey(now,pkg).split('-').map(Number);
  const tomorrowDate=parseScheduleDateTime(
    new Intl.DateTimeFormat('en-GB',{timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,day+1))),
    '12:00',pkg
  );
  const finished=hasFinished(today,pkg,now)||raceHasFinished(pkg,now);
  const showTomorrow=finished||!today.length;
  let next=scheduleForDate(pkg,tomorrowDate);
  let label='ПРОГРАММА НА ЗАВТРА';
  if(!today.length&&!next.length){
    const todayKey=calendarKey(now,pkg);
    const future=asArray(pkg?.original?.schedule)
      .map(item=>({item,date:parseScheduleDateTime(item?.date,'12:00',pkg)}))
      .filter(value=>value.date&&calendarKey(value.date,pkg)>todayKey)
      .sort((a,b)=>a.date-b.date);
    const firstKey=future[0]&&calendarKey(future[0].date,pkg);
    if(firstKey){
      next=future.filter(value=>calendarKey(value.date,pkg)===firstKey).map(value=>({...value.item,events:asArray(value.item.events)}));
      label='ПРОГРАММА БЛИЖАЙШЕГО ДНЯ';
    }
  }
  return {
    schedule:showTomorrow?next:today,
    scheduleLabel:showTomorrow?label:'ПРОГРАММА НА СЕГОДНЯ',
    raceFinished:raceHasFinished(pkg,now)
  };
}
