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

export function todaySummary(pkg,now=new Date()){
  const today=scheduleForDate(pkg,now);
  const [year,month,day]=calendarKey(now,pkg).split('-').map(Number);
  const tomorrowDate=parseScheduleDateTime(
    new Intl.DateTimeFormat('en-GB',{timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,day+1))),
    '12:00',pkg
  );
  const showTomorrow=!today.length||hasFinished(today,pkg,now);
  return {
    schedule:showTomorrow?scheduleForDate(pkg,tomorrowDate):today,
    scheduleLabel:showTomorrow?'ПРОГРАММА НА ЗАВТРА':'ПРОГРАММА НА СЕГОДНЯ'
  };
}
