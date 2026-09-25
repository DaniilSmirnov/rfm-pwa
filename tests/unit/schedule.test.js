import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  raceYearHint, validTimeZone, raceTimezone, textualMonth, parseScheduleDateTime,
  normalizeStageKey, stageIdentity, parseCoordinatePair, pointCoordinate,
  stageFeatureMatches, stageFeatureScore, matchStageFeature, buildStageDescriptors, findStageDescriptorByFeature,
  findStageLocations, classifyStageScheduleEvent, buildRaceReminders
} from '../../src/app/schedule.js';

afterEach(()=>vi.useRealTimers());

const makePkg=(overrides={})=>({
  id:'race-1',raceId:1,name:'Test Rally',
  summary:{dates:'10.10.2026'},
  original:{city_race:'Республика Карелия',schedule:[]},
  geojson:{type:'FeatureCollection',features:[]},
  ...overrides
});

describe('race timezone and schedule parsing',()=>{
  it('uses explicit IANA timezone',()=>expect(raceTimezone({timezone:'Asia/Tokyo'})).toBe('Asia/Tokyo'));
  it('recognizes Khabarovsk timezone',()=>expect(raceTimezone({original:{city_race:'Хабаровский край'}})).toBe('Asia/Vladivostok'));
  it('recognizes Perm timezone',()=>expect(raceTimezone({original:{city_race:'Пермский край'}})).toBe('Asia/Yekaterinburg'));
  it('recognizes Kirov timezone',()=>expect(raceTimezone({original:{city_race:'Кировская область'}})).toBe('Europe/Kirov'));
  it('falls back to Moscow',()=>expect(raceTimezone({original:{city_race:'Неизвестный регион'}})).toBe('Europe/Moscow'));
  it('validates timezone names',()=>{expect(validTimeZone('Europe/Moscow')).toBe(true);expect(validTimeZone('Mars/Olympus')).toBe(false);});
  it('gets year from race summary',()=>expect(raceYearHint(makePkg())).toBe(2026));

  it.each([
    ['января',1],['ФЕВ.',2],['марта',3],['апрель',4],['мая',5],['июня',6],
    ['июля',7],['август',8],['сентября',9],['октябрь',10],['ноября',11],['декабрь',12]
  ])('parses textual month',(name,month)=>expect(textualMonth(name)).toBe(month));

  it('parses numeric schedule date in race timezone',()=>{
    const d=parseScheduleDateTime('10.10.2026','12:30',makePkg());
    expect(d.toISOString()).toBe('2026-10-10T09:30:00.000Z');
  });
  it('parses textual schedule date using race year',()=>{
    const d=parseScheduleDateTime('10 октября, СБ','08:15',makePkg());
    expect(d.toISOString()).toBe('2026-10-10T05:15:00.000Z');
  });
  it('honors Yekaterinburg offset',()=>{
    const p=makePkg({original:{city_race:'Пермский край',schedule:[]}});
    expect(parseScheduleDateTime('10.10.2026','12:30',p).toISOString()).toBe('2026-10-10T07:30:00.000Z');
  });
  it.each([['bad','12:00'],['10.10.2026','25:00'],['32.10.2026','12:00'],['10 foo','12:00']])(
    'rejects invalid schedule values',(date,time)=>expect(parseScheduleDateTime(date,time,makePkg())).toBeNull()
  );
});

describe('stage helpers',()=>{
  it.each([
    ['СУ 1','су-1'],['SS-12A','ss-12a'],[' СУ № 3/4 ','су-3-4']
  ])('normalizes stage key',(raw,key)=>expect(normalizeStageKey(raw)).toBe(key));

  it('detects stage from location',()=>expect(stageIdentity({location:'СУ 4 Лахденпохья',events:[]})?.key).toBe('су-4'));
  it('detects stage from event text',()=>expect(stageIdentity({location:'Перекрытие',events:[{text:'Закрытие SS 2'}]})?.key).toBe('ss-2'));
  it('ignores non-stage schedule item',()=>expect(stageIdentity({location:'Торжественное открытие',events:[]})).toBeNull());

  it.each([
    ['60.1, 30.2',{lat:60.1,lon:30.2}],
    ['30.2 60.1',{lat:30.2,lon:60.1}],
    ['',null],['999,999',null]
  ])('parses coordinate pair',(raw,expected)=>expect(parseCoordinatePair(raw)).toEqual(expected));

  it('reads GeoJSON point coordinate',()=>expect(pointCoordinate({geometry:{type:'Point',coordinates:[30.2,60.1]}})).toEqual({lat:60.1,lon:30.2}));
  it('rejects non-point coordinate',()=>expect(pointCoordinate({geometry:{type:'LineString',coordinates:[]}})).toBeNull());

  it('matches stage number in feature properties',()=>{
    expect(stageFeatureMatches({properties:{name:'Старт СУ 7'}},{name:'СУ 7',key:'су-7'})).toBe(true);
  });

  it('matches SS geometry to the same numbered СУ descriptor',()=>{
    const feature={properties:{name:'SS 3 Harlu'},geometry:{type:'LineString',coordinates:[[30,60],[31,61]]}};
    expect(stageFeatureScore(feature,{name:'СУ 3',key:'су-3'})).toBeGreaterThanOrEqual(70);
    expect(matchStageFeature({name:'СУ 3',key:'су-3'},[feature])).toBe(feature);
  });

  it('builds stage descriptors with geometry and road closure events',()=>{
    const route={properties:{kind:'yandex-line',name:'SS 3 Harlu'},geometry:{type:'LineString',coordinates:[[30,60],[31,61]]}};
    const p=makePkg({
      original:{city_race:'Карелия',schedule:[{
        date:'10.10.2026',location:'СУ 3',events:[
          {time:'09:30',text:'Закрытие дороги'},
          {time:'13:00',text:'Старт первого экипажа'},
          {time:'15:00',text:'Открытие дороги'}
        ]
      }]},
      geojson:{type:'FeatureCollection',features:[route]}
    });
    const [stage]=buildStageDescriptors(p);
    expect(stage).toMatchObject({key:'су-3',name:'СУ 3',geometry:route.geometry});
    expect(stage.events.map(x=>x.kind)).toEqual(['close',null,'open']);
    expect(findStageDescriptorByFeature([stage],route)?.key).toBe('су-3');
  });

  it('prefers an exact stage line over weaker same-number metadata',()=>{
    const exact={properties:{name:'СУ 4'},geometry:{type:'LineString',coordinates:[[1,2],[2,3]]}};
    const weak={properties:{name:'SS 4 spectator access'},geometry:{type:'LineString',coordinates:[[3,4],[4,5]]}};
    expect(matchStageFeature({name:'СУ 4',key:'су-4'},[weak,exact])).toBe(exact);
  });

  it('derives stage ends from route geometry',()=>{
    const p=makePkg({geojson:{features:[{properties:{name:'СУ 5'},geometry:{type:'LineString',coordinates:[[30,60],[31,61]]}}]}});
    expect(findStageLocations(p,{location:'СУ 5'}, {name:'СУ 5',key:'су-5'})).toEqual({start:{lat:60,lon:30},finish:{lat:61,lon:31}});
  });

  it('classifies road closure',()=>expect(classifyStageScheduleEvent({location:'СУ 3'},{text:'Закрытие дороги'})?.kind).toBe('close'));
  it('classifies road reopening',()=>expect(classifyStageScheduleEvent({location:'SS 3'},{text:'Открытие дороги'})?.kind).toBe('open'));
  it('ignores unrelated stage event',()=>expect(classifyStageScheduleEvent({location:'СУ 3'},{text:'Старт первого экипажа'})).toBeNull());
});

describe('reminders',()=>{
  it('builds 60/30/15 minute reminders for subscribed stage',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    const p=makePkg({original:{city_race:'Карелия',schedule:[{date:'10.10.2026',location:'СУ 1',events:[{time:'12:00',text:'Закрытие дороги'}]}]}});
    const reminders=buildRaceReminders(p,new Set(['су-1']));
    expect(reminders).toHaveLength(3);
    expect(reminders.some(x=>x.body.includes('1 час'))).toBe(true);
    expect(reminders.some(x=>x.body.includes('30 мин'))).toBe(true);
    expect(reminders.some(x=>x.body.includes('15 мин'))).toBe(true);
  });

  it('does not build reminders for unsubscribed stages',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    const p=makePkg({original:{city_race:'Карелия',schedule:[{date:'10.10.2026',location:'СУ 1',events:[{time:'12:00',text:'Закрытие дороги'}]}]}});
    expect(buildRaceReminders(p,new Set(['су-2']))).toEqual([]);
  });

  it('skips past reminders',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    const p=makePkg({original:{city_race:'Карелия',schedule:[{date:'10.10.2026',location:'СУ 1',events:[{time:'12:00',text:'Открытие дороги'}]}]}});
    expect(buildRaceReminders(p,new Set(['су-1']))).toEqual([]);
  });

  it('sorts reminders by due time',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    const p=makePkg({original:{city_race:'Карелия',schedule:[
      {date:'10.10.2026',location:'СУ 2',events:[{time:'14:00',text:'Закрытие дороги'}]},
      {date:'10.10.2026',location:'СУ 1',events:[{time:'12:00',text:'Закрытие дороги'}]}
    ]}});
    const r=buildRaceReminders(p,new Set(['су-1','су-2']));
    expect(r.map(x=>x.dueAt)).toEqual([...r.map(x=>x.dueAt)].sort((a,b)=>a-b));
  });
});
