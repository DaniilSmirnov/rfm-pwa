import { assetUrl, raceDetailToPackage } from '../rallyfans.js';

export const PERIODIC_CACHE='rfm-periodic-data-v1';
export const RACE_ASSET_CACHE='rfm-race-assets-v1';

function stable(value){
  if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  }
  return JSON.stringify(value);
}

function same(a,b){return stable(a)===stable(b);}
function sorted(values){return [...new Set(values||[])].sort();}

export function baseRaceGeoJson(pkg){
  return {
    type:'FeatureCollection',
    features:(pkg?.geojson?.features||[]).filter(f=>f?.properties?.source!=='yandex-constructor'&&f?.properties?.kind!=='local-car')
  };
}

export function rallyPackDiff(current,fresh){
  const changes=[];
  if(!same(current?.original?.schedule||[],fresh?.original?.schedule||[])) changes.push({key:'schedule',label:'Расписание'});
  if(!same(current?.original?.coordinates||[],fresh?.original?.coordinates||[])) changes.push({key:'points',label:'Точки гонки'});
  if(!same(sorted(current?.assetNames),sorted(fresh?.assetNames))) changes.push({key:'materials',label:'Материалы'});
  if(!same(current?.original?.results||[],fresh?.original?.results||[]) ||
     !same([current?.original?.results_race,current?.original?.results_race2,current?.original?.results_race3,current?.original?.results_race4,current?.original?.results_race5],
           [fresh?.original?.results_race,fresh?.original?.results_race2,fresh?.original?.results_race3,fresh?.original?.results_race4,fresh?.original?.results_race5])) {
    changes.push({key:'results',label:'Результаты'});
  }
  if(!same(current?.original?.lists||[],fresh?.original?.lists||[]) ||
     !same([current?.original?.list_crews,current?.original?.list_crews2,current?.original?.list_crews3,current?.original?.list_crews4,current?.original?.list_crews5],
           [fresh?.original?.list_crews,fresh?.original?.list_crews2,fresh?.original?.list_crews3,fresh?.original?.list_crews4,fresh?.original?.list_crews5])) {
    changes.push({key:'crews',label:'Экипажи'});
  }
  if(!same(current?.summary||{},fresh?.summary||{})) changes.push({key:'info',label:'Информация о гонке'});
  if(String(current?.original?.how_it_was||'')!==String(fresh?.original?.how_it_was||'')) changes.push({key:'story',label:'Материал «Как это было»'});
  if(String(current?.yandexMapEmbed||'')!==String(fresh?.yandexMapEmbed||'')) changes.push({key:'yandex',label:'Yandex Constructor'});
  return changes;
}

export function updateCompatibility(current,fresh){
  if(!same(baseRaceGeoJson(current),baseRaceGeoJson(fresh))) return {safe:false,reason:'geometry'};
  if(String(current?.yandexMapEmbed||'')!==String(fresh?.yandexMapEmbed||'')) return {safe:false,reason:'yandex'};
  return {safe:true,reason:null};
}

export function mergeSafeRaceUpdate(current,fresh,diff,now=new Date()){
  const yandex=(current?.geojson?.features||[]).filter(f=>f?.properties?.source==='yandex-constructor');
  return {
    ...fresh,
    id:current.id,
    savedAt:current.savedAt,
    geojson:{type:'FeatureCollection',features:[...(fresh.geojson?.features||[]),...yandex]},
    offlineMap:current.offlineMap,
    terrain:current.terrain,
    yandexImport:current.yandexImport,
    lastSmartUpdate:{appliedAt:now.toISOString(),changes:diff},
    pendingUpdate:null
  };
}

async function assetsReady(pkg){
  if(!('caches' in globalThis)) return !(pkg?.assetNames||[]).length;
  const cache=await caches.open(RACE_ASSET_CACHE);
  for(const name of pkg?.assetNames||[]){
    if(!(await cache.match(assetUrl(name)))) return false;
  }
  return true;
}

export async function processCachedRallyPackUpdates({getAllPackages,savePackage,scheduleRaceReminders}){
  if(!('caches' in globalThis)) return {checked:0,applied:0,pending:0};
  const cache=await caches.open(PERIODIC_CACHE);
  const packages=await getAllPackages();
  let checked=0,applied=0,pending=0;
  for(const current of packages.filter(p=>p?.raceId!=null)){
    const response=await cache.match(`/api/rallyfans/race/${encodeURIComponent(current.raceId)}`);
    if(!response) continue;
    checked++;
    let race;
    try{race=await response.clone().json();}catch{continue;}
    const fresh=raceDetailToPackage(race);
    const diff=rallyPackDiff(current,fresh);
    if(!diff.length) continue;
    const compatibility=updateCompatibility(current,fresh);
    const ready=compatibility.safe && await assetsReady(fresh);
    if(ready){
      const next=mergeSafeRaceUpdate(current,fresh,diff);
      await savePackage(next);
      try{await scheduleRaceReminders?.(next);}catch{}
      applied++;
    }else{
      await savePackage({
        ...current,
        pendingUpdate:{
          detectedAt:new Date().toISOString(),
          changes:diff,
          reason:compatibility.safe?'assets':compatibility.reason
        }
      });
      pending++;
    }
  }
  return {checked,applied,pending};
}
