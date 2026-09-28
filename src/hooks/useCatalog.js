import {useCallback,useMemo,useState} from 'react';
import {checkApiHealth,fetchRaceCatalog} from '../rallyfans.js';
import {raceWithinWeek,pickDefaultRace} from '../app/catalog-dates.js';
import {markBoot} from '../app/boot-diagnostics.js';

function chooseCatalog(catalog,query){
  const q=String(query||'').trim().toLowerCase();
  if(q)return catalog.filter(r=>[r.name,r.city_race,r.city_race_details,r.category_race,r.stage_race,r.dates,r.date_race].some(v=>String(v||'').toLowerCase().includes(q)));
  const candidate=pickDefaultRace(catalog.filter(raceWithinWeek));
  return candidate?[candidate]:[];
}

export function useCatalog(connectivityRef){
  const [catalog,setCatalog]=useState([]);
  const [catalogStatus,setCatalogStatus]=useState('Загружаю…');
  const [catalogQuery,setCatalogQuery]=useState('');
  const visibleCatalog=useMemo(()=>chooseCatalog(catalog,catalogQuery),[catalog,catalogQuery]);
  const clearCatalog=useCallback(()=>{
    setCatalogStatus('Офлайн: доступны уже скачанные гонки.');
    setCatalog([]);
  },[]);
  const loadCatalog=useCallback(async()=>{
    if(!connectivityRef.current){
      clearCatalog();markBoot('catalog-refresh-skipped',{reason:'offline'});return;
    }
    setCatalogStatus('Проверяю serverless proxy…');
    try{
      await checkApiHealth();setCatalogStatus('Загружаю список из api.rallyfansmap.ru…');
      const rows=await fetchRaceCatalog();setCatalog(rows);
      setCatalogStatus(`${rows.length} гонок · обновление сохранённых данных через Rally Pack`);
      markBoot('catalog-refresh-finished',{count:rows.length});
    }catch(error){
      setCatalogStatus(`API недоступен: ${error.message}`);
      markBoot('catalog-refresh-failed',{message:String(error?.message||error)});
    }
  },[clearCatalog,connectivityRef]);
  return {catalog,catalogStatus,catalogQuery,setCatalogQuery,visibleCatalog,loadCatalog,clearCatalog,setCatalogStatus};
}
