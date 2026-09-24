import { parseScheduleDateTime } from './date-utils.js';
const asArray=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
export function normalizeStageKey(name){return String(name||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80);}
export function stageIdentity(item){
  const events=asArray(item?.events),context=[item?.location,...events.map(e=>e?.text)].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  const stageMatch=context.match(/(?:^|\s)((?:СУ|SS)\s*[-№#]?\s*\d+[A-Za-zА-Яа-я0-9/-]*)/i);
  if(!stageMatch&&!/(?:СУ|SS)\s*[-№#]?\s*\d+|спец(?:иальный)?\s*участ/i.test(context))return null;
  const name=(stageMatch?.[1]||String(item?.location||'СУ')).replace(/\s+/g,' ').trim(),key=normalizeStageKey(name);
  return key?{key,name}:null;
}
export function parseCoordinatePair(value){
  const nums=String(value||'').match(/-?\d+(?:[.,]\d+)?/g)?.map(x=>Number(x.replace(',','.')))||[];
  if(nums.length<2)return null;const [a,b]=nums;
  if(Math.abs(a)<=90&&Math.abs(b)<=180)return {lat:a,lon:b};
  if(Math.abs(b)<=90&&Math.abs(a)<=180)return {lat:b,lon:a};
  return null;
}
export function pointCoordinate(feature){
  const coords=feature?.geometry?.coordinates;
  if(feature?.geometry?.type!=='Point'||!Array.isArray(coords)||coords.length<2)return null;
  const lon=Number(coords[0]),lat=Number(coords[1]);return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
}
export function stageFeatureMatches(feature,stage){
  const props=feature?.properties||{},text=Object.values(props).filter(v=>typeof v==='string'||typeof v==='number').join(' ').toLowerCase();
  const number=String(stage?.name||'').match(/\d+/)?.[0];
  if(number&&new RegExp(`(?:су|ss)\\s*[-№#]?\\s*${number}(?:\\D|$)`,'i').test(text))return true;
  return text.includes(String(stage?.name||'').toLowerCase())||text.includes(String(stage?.key||'').replace(/-/g,' '));
}
export function findStageLocations(pkg,item,stage){
  let start=parseCoordinatePair(item?.coordinates),finish=null,route=null;
  for(const feature of pkg?.geojson?.features||[]){
    if(!stageFeatureMatches(feature,stage))continue;
    const text=Object.values(feature?.properties||{}).filter(v=>typeof v==='string'||typeof v==='number').join(' '),point=pointCoordinate(feature);
    if(point){if(/старт|start/i.test(text)&&!start)start=point;if(/финиш|finish/i.test(text)&&!finish)finish=point;}
    if(!route&&feature?.geometry?.type==='LineString'&&Array.isArray(feature.geometry.coordinates))route=feature.geometry.coordinates;
  }
  if(route?.length>=2){const first=route[0],last=route[route.length-1];if(!start&&Array.isArray(first))start={lat:Number(first[1]),lon:Number(first[0])};if(!finish&&Array.isArray(last))finish={lat:Number(last[1]),lon:Number(last[0])};}
  return {start:start||null,finish:finish||null};
}
export function classifyStageScheduleEvent(item,event){
  const eventText=String(event?.text||'').trim(),context=`${String(item?.location||'')} ${eventText}`.replace(/\s+/g,' ').trim(),lower=eventText.toLowerCase();
  let kind=null;if(/закрыт|закрытие|закрывается|закрывают|перекрыт|перекрытие/.test(lower))kind='close';else if(/открыт|открытие|открывается|открывают|возобнов/.test(lower))kind='open';if(!kind)return null;
  const stageMatch=context.match(/(?:^|\s)((?:СУ|SS)\s*[-№#]?\s*\d+[A-Za-zА-Яа-я0-9/-]*)/i);
  if(!stageMatch&&!/\bСУ\b|\bSS\b|спец(?:иальный)?\s*участ/i.test(context))return null;
  const stageName=(stageMatch?.[1]||String(item?.location||'')||'СУ').replace(/\s+/g,' ').trim();
  return {kind,stageName,stageKey:normalizeStageKey(stageName),eventText};
}
export function reminderLeadLabel(minutes){return minutes===60?'1 час':`${minutes} мин`;}
export function buildRaceReminders(pkg,subscribedKeys,now=Date.now()){
  const schedule=asArray(pkg?.original?.schedule),raceId=pkg?.raceId??pkg?.id??'race',subscribed=subscribedKeys instanceof Set?subscribedKeys:new Set(subscribedKeys||[]),reminders=[],leadTimes=[60,30,15];
  if(!subscribed.size)return reminders;
  for(const item of schedule)for(const event of asArray(item?.events)){
    const classified=classifyStageScheduleEvent(item,event);if(!classified||!subscribed.has(classified.stageKey))continue;
    const startsAt=parseScheduleDateTime(item?.date,event?.time,pkg);if(!startsAt)continue;
    for(const leadMinutes of leadTimes){
      const dueAt=startsAt.getTime()-leadMinutes*60000;if(dueAt<=now||dueAt>now+14*24*60*60000)continue;
      const action=classified.kind==='close'?'Закрытие':'Открытие',stageSlug=classified.stageName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,40)||'stage';
      reminders.push({dueAt,title:String(pkg?.name||'Rally Fans Map'),body:`${action} ${classified.stageName} через ${reminderLeadLabel(leadMinutes)} · ${String(event?.time||'').trim()}`,url:'/',tag:`rfm-race-${raceId}-${classified.kind}-${stageSlug}-${leadMinutes}`,ttlSeconds:Math.max(1800,leadMinutes*60)});
    }
  }
  return reminders.sort((a,b)=>a.dueAt-b.dueAt).slice(0,192);
}
