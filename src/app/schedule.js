import { distanceMeters } from './geo.js';

const asArray = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);

export function raceYearHint(pkg){
  const raw=String(pkg?.summary?.dates || pkg?.original?.dates || pkg?.original?.date_race || '');
  const m=raw.match(/\b(20\d{2})\b/);
  return m?Number(m[1]):new Date().getFullYear();
}

const RACE_REGION_TIMEZONES=[
  [/хабаровск/i,'Asia/Vladivostok'],
  [/пермск/i,'Asia/Yekaterinburg'],
  [/свердловск/i,'Asia/Yekaterinburg'],
  [/тюменск/i,'Asia/Yekaterinburg'],
  [/челябинск/i,'Asia/Yekaterinburg'],
  [/кировск/i,'Europe/Kirov'],
  [/карачаево-?черкес/i,'Europe/Moscow'],
  [/краснодар/i,'Europe/Moscow'],
  [/карели/i,'Europe/Moscow'],
  [/ленинград/i,'Europe/Moscow'],
  [/московск/i,'Europe/Moscow'],
  [/новгород/i,'Europe/Moscow'],
  [/псков/i,'Europe/Moscow'],
  [/татарстан/i,'Europe/Moscow'],
  [/ростов/i,'Europe/Moscow'],
  [/ярослав/i,'Europe/Moscow']
];

export function validTimeZone(value){
  if(!value) return false;
  try{ new Intl.DateTimeFormat('en',{timeZone:String(value)}).format(new Date()); return true; }
  catch{ return false; }
}

export function raceTimezone(pkg){
  const explicit=[
    pkg?.timezone,
    pkg?.original?.timezone,
    pkg?.original?.time_zone,
    pkg?.original?.timezone_name,
    pkg?.original?.tz
  ].find(validTimeZone);
  if(explicit) return String(explicit);

  const region=String(pkg?.original?.city_race || '');
  const match=RACE_REGION_TIMEZONES.find(([re])=>re.test(region));
  if(match) return match[1];

  // Current RallyFans data is Russia-focused and the upstream API does not
  // expose a timezone field. Moscow time is the safest fallback for unknown regions.
  return 'Europe/Moscow';
}

export function zonedLocalDate(year,month,day,hour,minute,timeZone){
  const wall=Date.UTC(year,month-1,day,hour,minute,0,0);
  let formatter;
  try{
    formatter=new Intl.DateTimeFormat('en-CA',{
      timeZone,
      year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',
      hourCycle:'h23'
    });
  }catch{
    return null;
  }

  const partsAt=timestamp=>Object.fromEntries(
    formatter.formatToParts(new Date(timestamp))
      .filter(part=>part.type!=='literal')
      .map(part=>[part.type,part.value])
  );

  let guess=wall;
  for(let i=0;i<3;i++){
    const p=partsAt(guess);
    const represented=Date.UTC(
      Number(p.year),Number(p.month)-1,Number(p.day),
      Number(p.hour),Number(p.minute),Number(p.second),0
    );
    const offset=represented-guess;
    const next=wall-offset;
    if(next===guess) break;
    guess=next;
  }

  const p=partsAt(guess);
  if(Number(p.year)!==year || Number(p.month)!==month || Number(p.day)!==day ||
     Number(p.hour)!==hour || Number(p.minute)!==minute) return null;
  return new Date(guess);
}

const RUSSIAN_MONTHS={
  'янв':1,'январ':1,
  'фев':2,'феврал':2,
  'мар':3,'март':3,
  'апр':4,'апрел':4,
  'май':5,'мая':5,
  'июн':6,'июнь':6,'июня':6,
  'июл':7,'июль':7,'июля':7,
  'авг':8,'август':8,
  'сен':9,'сент':9,'сентябр':9,
  'окт':10,'октябр':10,
  'ноя':11,'ноябр':11,
  'дек':12,'декабр':12
};

export function textualMonth(value){
  const normalized=String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-я]/g,'');
  for(const [prefix,month] of Object.entries(RUSSIAN_MONTHS)){
    if(normalized.startsWith(prefix)) return month;
  }
  return null;
}

export function parseScheduleDateTime(dateText,timeText,pkg){
  const time=String(timeText||'').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if(!time) return null;

  const raw=String(dateText||'').trim();
  let day,month,year;
  let d=raw.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
  if(d){
    day=Number(d[1]); month=Number(d[2]); year=Number(d[3]);
  }else{
    d=raw.match(/\b(\d{1,2})[.\/-](\d{1,2})\b/);
    if(d){
      day=Number(d[1]); month=Number(d[2]); year=raceYearHint(pkg);
    }else{
      d=raw.match(/\b(\d{1,2})\s+([А-Яа-яЁё.]+)/);
      if(!d) return null;
      day=Number(d[1]); month=textualMonth(d[2]); year=raceYearHint(pkg);
      if(!month) return null;
    }
  }

  if(day<1 || day>31 || month<1 || month>12) return null;
  return zonedLocalDate(year,month,day,Number(time[1]),Number(time[2]),raceTimezone(pkg));
}


export function normalizeStageKey(name){
  return String(name||'')
    .toLowerCase()
    .replace(/ё/g,'е')
    .replace(/[^a-zа-я0-9]+/gi,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80);
}

export function stageIdentity(item){
  const events=asArray(item?.events);
  const context=[item?.location,...events.map(e=>e?.text)]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g,' ')
    .trim();

  const stageMatch=context.match(/(?:^|\s)((?:СУ|SS)\s*[-№#]?\s*\d+[A-Za-zА-Яа-я0-9/-]*)/i);
  const hasStageWord=/(?:СУ|SS)\s*[-№#]?\s*\d+|спец(?:иальный)?\s*участ/i.test(context);
  if(!stageMatch && !hasStageWord) return null;

  const name=(stageMatch?.[1] || String(item?.location||'СУ')).replace(/\s+/g,' ').trim();
  const key=normalizeStageKey(name);
  return key?{key,name}:null;
}

export function walletSerialForStage(pkg,stage){
  const race=String(pkg?.raceId ?? pkg?.id ?? 'race').replace(/[^a-z0-9_-]+/gi,'-').slice(0,48);
  const stagePart=String(stage?.key||'stage').replace(/[^a-z0-9_-]+/gi,'-').slice(0,48);
  return `rfm-${race}-${stagePart}`;
}

export function parseCoordinatePair(value){
  const nums=String(value||'').match(/-?\d+(?:[.,]\d+)?/g)?.map(x=>Number(x.replace(',','.'))) || [];
  if(nums.length<2) return null;
  let a=nums[0],b=nums[1];
  if(Math.abs(a)<=90 && Math.abs(b)<=180) return {lat:a,lon:b};
  if(Math.abs(b)<=90 && Math.abs(a)<=180) return {lat:b,lon:a};
  return null;
}

export function pointCoordinate(feature){
  const coords=feature?.geometry?.coordinates;
  if(feature?.geometry?.type!=='Point' || !Array.isArray(coords) || coords.length<2) return null;
  const lon=Number(coords[0]),lat=Number(coords[1]);
  return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
}

export function stageFeatureMatches(feature,stage){
  const props=feature?.properties||{};
  const text=Object.values(props).filter(v=>typeof v==='string'||typeof v==='number').join(' ').toLowerCase();
  const number=String(stage?.name||'').match(/\d+/)?.[0];
  if(number && new RegExp(`(?:су|ss)\\s*[-№#]?\\s*${number}(?:\\D|$)`,'i').test(text)) return true;
  return text.includes(String(stage?.name||'').toLowerCase()) || text.includes(String(stage?.key||'').replace(/-/g,' '));
}

export function findStageLocations(pkg,item,stage){
  let start=parseCoordinatePair(item?.coordinates);
  let finish=null;
  let route=null;

  for(const feature of pkg?.geojson?.features||[]){
    if(!stageFeatureMatches(feature,stage)) continue;
    const props=feature?.properties||{};
    const text=Object.values(props).filter(v=>typeof v==='string'||typeof v==='number').join(' ');
    const point=pointCoordinate(feature);
    if(point){
      if(/старт|start/i.test(text) && !start) start=point;
      if(/финиш|finish/i.test(text) && !finish) finish=point;
    }
    if(!route && feature?.geometry?.type==='LineString' && Array.isArray(feature.geometry.coordinates)){
      route=feature.geometry.coordinates;
    }
  }

  if(route?.length>=2){
    const first=route[0],last=route[route.length-1];
    if(!start && Array.isArray(first)) start={lat:Number(first[1]),lon:Number(first[0])};
    if(!finish && Array.isArray(last)) finish={lat:Number(last[1]),lon:Number(last[0])};
  }

  return {start:start||null,finish:finish||null};
}

export function stageWalletPayload(pkg,item,stage){
  const events=asArray(item?.events).map(event=>{
    const at=parseScheduleDateTime(item?.date,event?.time,pkg);
    return {
      time:String(event?.time||'').trim(),
      text:String(event?.text||'').trim(),
      at:at?at.toISOString():null
    };
  });
  const findAt=re=>events.find(e=>re.test(e.text))?.at||null;
  const locations=findStageLocations(pkg,item,stage);
  const future=events.map(e=>e.at).filter(Boolean).map(v=>new Date(v)).filter(d=>d.getTime()>Date.now()).sort((a,b)=>a-b)[0];

  return {
    serialNumber:walletSerialForStage(pkg,stage),
    raceId:String(pkg?.raceId ?? pkg?.id ?? ''),
    raceName:String(pkg?.name||'Rally Fans Map'),
    stageKey:stage.key,
    stageName:stage.name,
    date:String(item?.date||''),
    startLocation:locations.start,
    finishLocation:locations.finish,
    startAt:findAt(/старт|start/i),
    finishAt:findAt(/финиш|finish/i),
    closeAt:findAt(/закрыт|закрытие|перекрыт|перекрытие/i),
    openAt:findAt(/открыт|открытие|возобнов/i),
    relevantAt:future?.toISOString?.()||events.find(e=>e.at)?.at||null,
    events
  };
}

export function classifyStageScheduleEvent(item,event){
  const eventText=String(event?.text||'').trim();
  const context=`${String(item?.location||'')} ${eventText}`.replace(/\s+/g,' ').trim();
  const lower=eventText.toLowerCase();

  let kind=null;
  if(/закрыт|закрытие|закрывается|закрывают|перекрыт|перекрытие/.test(lower)) kind='close';
  else if(/открыт|открытие|открывается|открывают|возобнов/.test(lower)) kind='open';
  if(!kind) return null;

  const stageMatch=context.match(/(?:^|\s)((?:СУ|SS)\s*[-№#]?\s*\d+[A-Za-zА-Яа-я0-9/-]*)/i);
  const hasStageWord=/\bСУ\b|\bSS\b|спец(?:иальный)?\s*участ/i.test(context);
  if(!stageMatch && !hasStageWord) return null;

  const stageName=(stageMatch?.[1] || String(item?.location||'') || 'СУ')
    .replace(/\s+/g,' ')
    .trim();

  return {kind,stageName,stageKey:normalizeStageKey(stageName),eventText};
}

function featureText(feature){
  return Object.values(feature?.properties||{})
    .filter(v=>typeof v==='string'||typeof v==='number')
    .join(' ')
    .replace(/\s+/g,' ')
    .trim();
}

function stageNumber(value){
  return String(value||'').match(/(?:СУ|SS)\s*[-№#]?\s*(\d+)/i)?.[1]
    || String(value||'').match(/\b(\d+)\b/)?.[1]
    || null;
}

export function stageFeatureScore(feature,stage){
  if(!feature?.geometry || !['LineString','MultiLineString'].includes(feature.geometry.type)) return -1;
  const text=featureText(feature);
  if(!text) return -1;
  const normalizedText=normalizeStageKey(text);
  const normalizedName=normalizeStageKey(stage?.name);
  const normalizedKey=normalizeStageKey(stage?.key);
  const names=['name','title','caption','subtitle']
    .map(key=>normalizeStageKey(feature?.properties?.[key]))
    .filter(Boolean);
  if(normalizedName && names.includes(normalizedName)) return 100;
  if(normalizedName && names.some(name=>name.includes(normalizedName))) return 90;
  if(normalizedKey && names.some(name=>name.includes(normalizedKey))) return 85;
  if(normalizedName && normalizedText.includes(normalizedName)) return 80;
  const expectedNumber=stageNumber(stage?.name||stage?.key);
  const actualNumber=stageNumber(text);
  if(expectedNumber && actualNumber===expectedNumber) return 70;
  return stageFeatureMatches(feature,stage)?50:-1;
}

export function matchStageFeature(stage,features=[]){
  const candidates=(features||[])
    .map(feature=>({feature,score:stageFeatureScore(feature,stage)}))
    .filter(item=>item.score>=0)
    .sort((a,b)=>b.score-a.score);
  return candidates[0]?.feature||null;
}

export function buildStageDescriptors(pkg){
  const schedule=asArray(pkg?.original?.schedule);
  const features=pkg?.geojson?.features||[];
  const byKey=new Map();

  for(const item of schedule){
    const identity=stageIdentity(item);
    if(!identity) continue;
    let descriptor=byKey.get(identity.key);
    if(!descriptor){
      descriptor={
        key:identity.key,
        name:identity.name,
        date:String(item?.date||''),
        location:String(item?.location||''),
        scheduleItems:[],
        events:[],
        geometryFeature:null,
        geometry:null
      };
      byKey.set(identity.key,descriptor);
    }
    descriptor.scheduleItems.push(item);
    for(const event of asArray(item?.events)){
      const classified=classifyStageScheduleEvent(item,event);
      const at=parseScheduleDateTime(item?.date,event?.time,pkg);
      descriptor.events.push({
        date:String(item?.date||''),
        time:String(event?.time||'').trim(),
        text:String(event?.text||'').trim(),
        kind:classified?.kind||null,
        at:at?at.toISOString():null
      });
    }
  }

  for(const descriptor of byKey.values()){
    const feature=matchStageFeature(descriptor,features);
    descriptor.geometryFeature=feature;
    descriptor.geometry=feature?.geometry||null;
  }
  return [...byKey.values()];
}

export function findStageDescriptorByFeature(descriptors,feature){
  if(!feature) return null;
  let best=null;
  for(const stage of descriptors||[]){
    if(stage.geometryFeature===feature) return stage;
    const score=stageFeatureScore(feature,stage);
    if(score>=0 && (!best || score>best.score)) best={stage,score};
  }
  return best?.stage||null;
}

export function distanceAlongStage(stage,point){
  const geometry=stage?.geometry;
  if(!geometry||!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon)) return null;
  const lines=geometry.type==='LineString'?[geometry.coordinates]
    :geometry.type==='MultiLineString'?geometry.coordinates:[];
  let total=0,best=null;
  for(const line of lines){
    for(let i=1;i<(line||[]).length;i++){
      const a=line[i-1],b=line[i];
      if(!Array.isArray(a)||!Array.isArray(b)||![...a,...b].every(Number.isFinite)) continue;
      const segment=distanceMeters({lat:a[1],lon:a[0]},{lat:b[1],lon:b[0]});
      const meanLat=(a[1]+b[1]+point.lat)/3*Math.PI/180;
      const sx=(b[0]-a[0])*Math.cos(meanLat),sy=b[1]-a[1];
      const px=(point.lon-a[0])*Math.cos(meanLat),py=point.lat-a[1];
      const denom=sx*sx+sy*sy;
      const t=denom?Math.max(0,Math.min(1,(px*sx+py*sy)/denom)):0;
      const projected={lat:a[1]+(b[1]-a[1])*t,lon:a[0]+(b[0]-a[0])*t};
      const offset=distanceMeters(point,projected);
      if(!best||offset<best.offset) best={offset,progress:total+segment*t};
      total+=segment;
    }
  }
  if(!best||best.offset>250||total<=0) return null;
  return {fromStart:best.progress,toFinish:Math.max(0,total-best.progress),total,offset:best.offset};
}

export function reminderLeadLabel(minutes){
  if(minutes===60) return '1 час';
  return `${minutes} мин`;
}

export function buildRaceReminders(pkg,subscribed=new Set(),now=Date.now()){
  const schedule=asArray(pkg?.original?.schedule);
  const raceId=pkg?.raceId ?? pkg?.id ?? 'race';
  const reminders=[];
  const leadTimes=[60,30,15];
  if(!subscribed.size) return reminders;

  for(const item of schedule){
    for(const event of asArray(item?.events)){
      const classified=classifyStageScheduleEvent(item,event);
      if(!classified || !subscribed.has(classified.stageKey)) continue;

      const startsAt=parseScheduleDateTime(item?.date,event?.time,pkg);
      if(!startsAt) continue;

      for(const leadMinutes of leadTimes){
        const dueAt=startsAt.getTime()-leadMinutes*60*1000;
        if(dueAt<=now || dueAt>now+14*24*60*60*1000) continue;

        const action=classified.kind==='close'?'Закрытие':'Открытие';
        const stageSlug=classified.stageName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,40)||'stage';

        reminders.push({
          dueAt,
          title:String(pkg?.name || 'Rally Fans Map'),
          body:`${action} ${classified.stageName} через ${reminderLeadLabel(leadMinutes)} · ${String(event?.time||'').trim()}`,
          url:'/',
          tag:`rfm-race-${raceId}-${classified.kind}-${stageSlug}-${leadMinutes}`,
          ttlSeconds:Math.max(1800,leadMinutes*60)
        });
      }
    }
  }

  return reminders
    .sort((a,b)=>a.dueAt-b.dueAt)
    .slice(0,192);
}
