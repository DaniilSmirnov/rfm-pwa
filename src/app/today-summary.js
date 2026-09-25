import { parseScheduleDateTime } from './schedule.js';

const asArray=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
const dateKey=value=>String(value||'').match(/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/)?.[0]||'';

export function scheduleForDate(pkg,date=new Date()){
  const key=`${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}`;
  return asArray(pkg?.original?.schedule).filter(item=>dateKey(item?.date)===key);
}

function hasFinished(schedule,pkg,now){
  const moments=schedule.flatMap(item=>asArray(item?.events)
    .map(event=>parseScheduleDateTime(item?.date,event?.time,pkg))
    .filter(Boolean));
  return moments.length>0&&moments.every(moment=>moment.getTime()<=now.getTime());
}

export function todaySummary(pkg,now=new Date()){
  const today=scheduleForDate(pkg,now);
  const tomorrowDate=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  const showTomorrow=hasFinished(today,pkg,now);
  return {
    schedule:showTomorrow?scheduleForDate(pkg,tomorrowDate):today,
    scheduleLabel:showTomorrow?'ПРОГРАММА НА ЗАВТРА':'ПРОГРАММА НА СЕГОДНЯ'
  };
}
