import { crewResultClasses, crewResultViews, filterCrewResultsByClass } from './crew-results.js';

const asArray=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
const dateKey=value=>String(value||'').match(/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/)?.[0]||'';

export function scheduleForDate(pkg,date=new Date()){
  const key=`${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}`;
  return asArray(pkg?.original?.schedule).filter(item=>dateKey(item?.date)===key);
}

export function podiumByClass(snapshot){
  const view=crewResultViews(snapshot?.eventResults).find(item=>item.key==='overall');
  const results=view?.results||[];
  return crewResultClasses(results).map(className=>({
    className,
    results:filterCrewResultsByClass(results,className).filter(result=>!result.goingOff&&!result.goingOffAfterSu).slice(0,3)
  })).filter(group=>group.results.length);
}

export function todaySummary(pkg,date=new Date()){
  return {
    schedule:scheduleForDate(pkg,date),
    yesterday:scheduleForDate(pkg,new Date(date.getFullYear(),date.getMonth(),date.getDate()-1)),
    podiums:podiumByClass(pkg?.crewResults)
  };
}
