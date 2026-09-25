import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { savePackage, getAllPackages, deleteAllPackages, getPackage, clearMapTiles, getMapStorageStats } from '../db.js';
import { normalizePackage } from '../normalize.js';
import { checkApiHealth, fetchRaceCatalog, fetchRace, raceDetailToPackage, cacheRaceAssets, enrichPackageWithYandex } from '../rallyfans.js';
import { normalizePoint, googleMapsDirections, yandexNavigatorLink, yandexWebFallback, mapsMeLink, mapsMeWebFallback, coordinateText, openCustomSchemeWithFallback } from '../navigation.js';
import { buildDownloadPlan } from '../offline-map.js';
import { buildTerrainDownloadPlan } from '../terrain-offline.js';
import { safeFileName, geoJsonToGpx } from '../app/export.js';
import { distanceMeters, bearingDegrees, formatDistance, compassDirection } from '../app/geo.js';
import { getPushSubscription, refreshPushUi, scheduleRaceReminders, scheduleAllSavedReminders, setupPushUi } from '../app/push-client.js';
import { FAVORITES_KEY, favoritesForPackage, isFavoritePoint, setFavoritePoint, loadCarPoint, saveCarPoint, deleteCarPoint } from '../app/local-points.js';
import { ensurePersistentStorage, requestRallyPackBackgroundRefresh, setupPeriodicBackgroundSync, setupServiceWorkerUpdates } from '../app/runtime.js';
import { setupPwaInstall } from '../app/pwa.js';
import { initRaceMediaModal } from '../app/race-media.js';
import { downloadRallyPack } from '../app/rally-pack.js';
import { rallyPackProgressText } from '../app/rally-pack-ui.js';
import { processCachedRallyPackUpdates } from '../app/rally-pack-update.js';
import { setupErrorTelemetry } from '../app/telemetry.js';
import { raceWithinWeek, pickDefaultRace } from '../app/catalog-dates.js';
import { markBoot } from '../app/boot-diagnostics.js';
import { formatBytes } from '../app/format.js';
import { useOfflineStorageControls } from './useOfflineStorageControls.js';

let bootstrapPromise=null;
let mapLibrePromise=null;

export { formatBytes };

export async function ensureMapLibre(){
  if(window.maplibregl) return window.maplibregl;
  if(!mapLibrePromise){
    mapLibrePromise=import('/vendor/maplibre-gl/maplibre-gl.mjs').then(module=>{
      module.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');
      window.maplibregl=module;
      return module;
    });
  }
  const maplibregl=await mapLibrePromise;
  if(typeof maplibregl.supported==='function'&&!maplibregl.supported()) throw new Error('WebGL2 недоступен в этом браузере/PWA');
  return maplibregl;
}

function bootstrapRuntime(){
  if(bootstrapPromise) return bootstrapPromise;
  markBoot('runtime-bootstrap-start',{online:navigator.onLine});
  setupErrorTelemetry();
  setupPwaInstall();
  setupPushUi();
  initRaceMediaModal();
  bootstrapPromise=(async()=>{
    const sw=await setupServiceWorkerUpdates({onDiagnostic:(name,detail)=>markBoot(name,detail)});
    markBoot('service-worker-ready',{registered:Boolean(sw)});
    const storage=await ensurePersistentStorage();
    markBoot('persistent-storage-checked',storage);
    const periodic=await setupPeriodicBackgroundSync(sw);
    markBoot('periodic-sync-checked',periodic);
    requestRallyPackBackgroundRefresh(sw);
    const smartUpdate=await processCachedRallyPackUpdates({getAllPackages,savePackage,scheduleRaceReminders}).catch(e=>{console.warn('Smart Rally Pack update failed',e);return null;});
    markBoot('cached-updates-processed',smartUpdate);
    await refreshPushUi();
    markBoot('push-ui-ready');
    try{ if(await getPushSubscription()) await scheduleAllSavedReminders(); }
    catch(e){ console.warn('Could not refresh scheduled race reminders on startup',e);markBoot('push-reminders-failed',{message:String(e?.message||e)}); }
    markBoot('runtime-bootstrap-finished');
    return sw;
  })();
  return bootstrapPromise;
}

function downloadBlob(filename,type,text){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function sharePointValue(point){
  if(!point) return false;
  const title=point.name||'Точка RallyFans Map';
  const coords=coordinateText(point);
  const url=yandexWebFallback(point);
  const data={title,text:`${title}\n${coords}`,url};
  try{
    if(navigator.share){await navigator.share(data);return true;}
  }catch(e){if(e?.name==='AbortError') return false;}
  try{await navigator.clipboard.writeText(`${title}\n${coords}\n${url}`);return true;}
  catch{return false;}
}

function chooseVisiblePackages(packages,query){
  const q=String(query||'').trim().toLowerCase();
  if(q) return packages.filter(p=>[
    p.name,p.summary?.stage,p.summary?.dates,p.summary?.city,p.summary?.category,p.summary?.status
  ].some(v=>String(v||'').toLowerCase().includes(q)));
  const near=pickDefaultRace(packages.filter(raceWithinWeek));
  return near?[near]:(packages[0]?[packages[0]]:[]);
}

function chooseCatalog(catalog,query){
  const q=String(query||'').trim().toLowerCase();
  if(q) return catalog.filter(r=>[
    r.name,r.city_race,r.city_race_details,r.category_race,r.stage_race,r.dates,r.date_race
  ].some(v=>String(v||'').toLowerCase().includes(q)));
  const candidate=pickDefaultRace(catalog.filter(raceWithinWeek));
  return candidate?[candidate]:[];
}

export function useRfmApp(){
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [catalog,setCatalog]=useState([]);
  const [catalogStatus,setCatalogStatus]=useState('Загружаю…');
  const [catalogQuery,setCatalogQuery]=useState('');
  const [packages,setPackages]=useState([]);
  const [packageQuery,setPackageQuery]=useState('');
  const [storageStats,setStorageStats]=useState({count:0,jsonBytes:0,mapBytes:0,mapCount:0,persisted:false});
  const [currentPackage,setCurrentPackage]=useState(null);
  const [selectedPoint,setSelectedPoint]=useState(null);
  const [favoritesRevision,setFavoritesRevision]=useState(0);
  const [carPoint,setCarPointState]=useState(()=>loadCarPoint());
  const [userPos,setUserPos]=useState(null);
  const [geoStatus,setGeoStatus]=useState('Геопозиция ещё не запрашивалась.');
  const [geoClass,setGeoClass]=useState('');
  const [navStatus,setNavStatus]=useState('');
  const [raceProgress,setRaceProgress]=useState({});
  const [mapDiag,setMapDiag]=useState('');
  const [compassHeading,setCompassHeading]=useState(null);
  const [compassEnabled,setCompassEnabled]=useState(false);
  const swRef=useRef(null);
  const geoWatchRef=useRef(null);

  const refreshPackages=useCallback(async(preferredId=null)=>{
    const started=performance.now();
    const pkgs=(await getAllPackages()).sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));
    setPackages(pkgs);
    const jsonBytes=pkgs.reduce((sum,p)=>sum+(p.size||0),0);
    const maps=await getMapStorageStats();
    let persisted=false;try{persisted=Boolean(await navigator.storage?.persisted?.());}catch{}
    setStorageStats({count:pkgs.length,jsonBytes,mapBytes:maps.bytes,mapCount:maps.count,persisted});
    markBoot('saved-data-loaded',{packages:pkgs.length,mapTiles:maps.count,durationMs:Math.round(performance.now()-started)});
    const currentId=preferredId||currentPackage?.id;
    if(currentId){
      const next=pkgs.find(p=>p.id===currentId)||null;
      setCurrentPackage(next);
    }else{
      const first=chooseVisiblePackages(pkgs,packageQuery)[0]||null;
      setCurrentPackage(first);
    }
    return pkgs;
  },[currentPackage?.id,packageQuery]);

  const offlineStorage=useOfflineStorageControls({currentPackage,setCurrentPackage,refreshPackages});

  useEffect(()=>{
    const refresh=()=>void refreshPackages(currentPackage?.id).catch(error=>markBoot('saved-data-refresh-failed',{message:String(error?.message||error)}));
    window.addEventListener('rfm:refresh-local-data',refresh);
    return()=>window.removeEventListener('rfm:refresh-local-data',refresh);
  },[refreshPackages,currentPackage?.id]);

  const selectPackage=useCallback(async id=>{
    try{
      const pkg=await getPackage(id);
      if(pkg){setCurrentPackage(pkg);offlineStorage.clearMapError();}
      return pkg;
    }catch(error){
      markBoot('saved-package-read-failed',{id,message:String(error?.message||error)});
      setNavStatus(`Не удалось открыть сохранённые данные: ${error.message}`);
      return null;
    }
  },[offlineStorage.clearMapError]);

  const loadCatalog=useCallback(async()=>{
    if(!navigator.onLine){
      setCatalogStatus('Офлайн: доступны уже скачанные гонки.');
      setCatalog([]);
      markBoot('catalog-refresh-skipped',{reason:'offline'});
      return;
    }
    setCatalogStatus('Проверяю serverless proxy…');
    try{
      await checkApiHealth();
      setCatalogStatus('Загружаю список из api.rallyfansmap.ru…');
      const rows=await fetchRaceCatalog();
      setCatalog(rows);
      setCatalogStatus(`${rows.length} гонок · обновление сохранённых данных через Rally Pack`);
      markBoot('catalog-refresh-finished',{count:rows.length});
    }catch(error){
      setCatalogStatus(`API недоступен: ${error.message}`);
      markBoot('catalog-refresh-failed',{message:String(error?.message||error)});
    }
  },[]);

  useEffect(()=>{
    let alive=true;
    bootstrapRuntime().then(sw=>{if(alive) swRef.current=sw;});
    refreshPackages().catch(error=>markBoot('saved-data-load-failed',{message:String(error?.message||error)}));
    loadCatalog();
    const onOnline=()=>{setOnline(true);loadCatalog();requestRallyPackBackgroundRefresh(swRef.current);};
    const onOffline=()=>setOnline(false);
    const onPeriodic=async()=>{
      const result=await processCachedRallyPackUpdates({getAllPackages,savePackage,scheduleRaceReminders}).catch(()=>null);
      if(result?.applied||result?.pending) await refreshPackages(currentPackage?.id);
    };
    const onBackground=event=>{
      const detail=event.detail||{};
      if(detail.status==='success') setCatalogStatus('Офлайн-материалы готовы ✓');
      if(detail.status==='failure') setCatalogStatus('Не удалось скачать часть офлайн-материалов.');
    };
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    window.addEventListener('rfm:periodic-update',onPeriodic);
    window.addEventListener('rfm:background-fetch',onBackground);
    return()=>{
      alive=false;
      window.removeEventListener('online',onOnline);
      window.removeEventListener('offline',onOffline);
      window.removeEventListener('rfm:periodic-update',onPeriodic);
      window.removeEventListener('rfm:background-fetch',onBackground);
      if(geoWatchRef.current!=null) navigator.geolocation?.clearWatch?.(geoWatchRef.current);
    };
  },[]);

  useEffect(()=>{
    const input=document.getElementById('catalogSearch');
    if(!input) return;
    const handler=e=>setCatalogQuery(e.target.value);
    input.addEventListener('input',handler);
    return()=>input.removeEventListener('input',handler);
  },[]);
  useEffect(()=>{
    const input=document.getElementById('packageSearch');
    if(!input) return;
    const handler=e=>setPackageQuery(e.target.value);
    input.addEventListener('input',handler);
    return()=>input.removeEventListener('input',handler);
  },[]);

  const visiblePackages=useMemo(()=>chooseVisiblePackages(packages,packageQuery),[packages,packageQuery]);
  const visibleCatalog=useMemo(()=>chooseCatalog(catalog,catalogQuery),[catalog,catalogQuery]);
  const downloadedIds=useMemo(()=>new Set(packages.filter(x=>x.raceId!=null).map(x=>Number(x.raceId))),[packages]);
  const favorites=useMemo(()=>currentPackage?favoritesForPackage(currentPackage.id):[],[currentPackage?.id,favoritesRevision]);

  useEffect(()=>{
    if(!currentPackage&&visiblePackages[0]) setCurrentPackage(visiblePackages[0]);
  },[currentPackage,visiblePackages]);

  const importFiles=useCallback(async files=>{
    for(const file of files){
      try{
        const pkg=normalizePackage(JSON.parse(await file.text()),`file:${file.name}`);
        await savePackage(pkg);
        await refreshPackages(pkg.id);
        setCurrentPackage(pkg);
      }catch(error){alert(`Не удалось импортировать ${file.name}: ${error.message}`);}
    }
  },[refreshPackages]);

  const downloadRace=useCallback(async id=>{
    setRaceProgress(p=>({...p,[id]:'Собираю Rally Pack…'}));
    try{
      await ensurePersistentStorage();
      const result=await downloadRallyPack(id,{
        fetchRace,raceDetailToPackage,getPackage,enrichPackageWithYandex,downloadOfflineMap,cacheRaceAssets,savePackage,
        scheduleRaceReminders,discardOfflineMapRevision,
        onOptionalError:(phase,error)=>console.warn(`Rally Pack optional step failed: ${phase}`,error)
      },event=>setRaceProgress(p=>({...p,[id]:rallyPackProgressText(event,formatBytes)})));
      await refreshPackages(result.pkg.id);
      setCurrentPackage(await getPackage(result.pkg.id));
      setRaceProgress(p=>({...p,[id]:rallyPackProgressText({phase:'done',assetDownload:result.assetDownload},formatBytes)}));
    }catch(error){
      alert(`Не удалось скачать Rally Pack: ${error.message}`);
      setRaceProgress(p=>({...p,[id]:null}));
    }
  },[refreshPackages]);

  const toggleFavorite=useCallback((point,force)=>{
    if(!currentPackage||!point) return;
    const enabled=force??!isFavoritePoint(point,currentPackage.id);
    setFavoritePoint(point,enabled,currentPackage.id);
    setFavoritesRevision(v=>v+1);
  },[currentPackage]);

  const showPoint=useCallback(point=>{setSelectedPoint(point);setNavStatus('');},[]);
  const sharePoint=useCallback(async point=>{
    const ok=await sharePointValue(point);
    setNavStatus(ok?(navigator.share?'Открыто системное меню «Поделиться».':'Точка скопирована.'):'Не удалось поделиться точкой.');
    return ok;
  },[]);

  const saveCar=useCallback(()=>{
    if(!navigator.geolocation){setGeoStatus('Геолокация не поддерживается.');return;}
    setGeoStatus('Определяю координаты машины…');
    navigator.geolocation.getCurrentPosition(pos=>{
      const coords=pos.coords;
      setUserPos(coords);
      const saved=saveCarPoint({lat:coords.latitude,lon:coords.longitude,name:'Машина'});
      setCarPointState(saved);
      setGeoStatus(`Геопозиция включена · точность ±${Math.round(coords.accuracy||0)} м`);
      setGeoClass('geo-ok');
    },error=>{
      setGeoStatus(`Не удалось сохранить машину: ${error.message}`);
      setGeoClass('geo-error');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  },[]);

  const removeCar=useCallback(()=>{
    deleteCarPoint();
    setCarPointState(null);
    if(['Машина','🚗 Машина'].includes(selectedPoint?.name)) setSelectedPoint(null);
  },[selectedPoint]);

  const requestLocation=useCallback(()=>{
    if(!navigator.geolocation){setGeoStatus('Геолокация не поддерживается этим браузером.');return;}
    if(geoWatchRef.current!=null&&userPos){
      setGeoStatus(`Геопозиция включена · точность ±${Math.round(userPos.accuracy||0)} м`);
      setGeoClass('geo-ok');
      return;
    }
    setGeoStatus('Запрашиваю доступ к геопозиции…');
    let first=true;
    geoWatchRef.current=navigator.geolocation.watchPosition(pos=>{
      setUserPos({...pos.coords,__center:first});
      setGeoStatus(`Геопозиция включена · точность ±${Math.round(pos.coords.accuracy||0)} м`);
      setGeoClass('geo-ok');
      first=false;
    },error=>{
      geoWatchRef.current=null;
      setGeoStatus(error.code===1?'Доступ к геопозиции запрещён. Разреши его в настройках сайта.':`Геолокация недоступна: ${error.message}`);
      setGeoClass('geo-error');
    },{enableHighAccuracy:true,timeout:15000,maximumAge:3000});
  },[userPos]);

  useEffect(()=>{
    if(!compassEnabled) return;
    const handler=event=>{
      let heading=null;
      if(Number.isFinite(event.webkitCompassHeading)) heading=event.webkitCompassHeading;
      else if(Number.isFinite(event.alpha)) heading=(360-event.alpha)%360;
      if(Number.isFinite(heading)) setCompassHeading(heading);
    };
    window.addEventListener('deviceorientationabsolute',handler,true);
    window.addEventListener('deviceorientation',handler,true);
    return()=>{
      window.removeEventListener('deviceorientationabsolute',handler,true);
      window.removeEventListener('deviceorientation',handler,true);
    };
  },[compassEnabled]);

  const enableCompass=useCallback(async()=>{
    try{
      if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
        const permission=await DeviceOrientationEvent.requestPermission();
        if(permission!=='granted') throw new Error('доступ к датчику не разрешён');
      }
      setCompassEnabled(true);
      if(!userPos) requestLocation();
    }catch(error){setNavStatus(`Компас недоступен: ${error.message}`);}
  },[requestLocation,userPos]);

  const compass=useMemo(()=>{
    if(!selectedPoint||!userPos) return null;
    try{
      const target=normalizePoint(selectedPoint);
      const here={lat:Number(userPos.latitude),lon:Number(userPos.longitude)};
      const bearing=bearingDegrees(here,target);
      const distance=distanceMeters(here,target);
      const relative=Number.isFinite(compassHeading)?((bearing-compassHeading)+360)%360:bearing;
      return {bearing,distance,relative,direction:compassDirection(bearing)};
    }catch{return null;}
  },[selectedPoint,userPos,compassHeading]);

  const importYandex=useCallback(async()=>{
    if(!currentPackage) return;
    try{
      const result=await enrichPackageWithYandex(currentPackage);
      await savePackage(result.pkg);
      setCurrentPackage(result.pkg);await refreshPackages(result.pkg.id);
    }catch(error){alert(`Не удалось импортировать Yandex Constructor: ${error.message}`);}
  },[currentPackage,refreshPackages]);

  const clearAll=useCallback(async()=>{
    if(!confirm('Удалить все сохранённые гонки, карты, изображения и избранные точки?')) return;
    try{
      await deleteAllPackages();await clearMapTiles();
      if('caches' in window) await caches.delete('rfm-race-assets-v1');
      localStorage.removeItem(FAVORITES_KEY);
    }catch(error){
      markBoot('offline-data-clear-failed',{message:String(error?.message||error)});
      await refreshPackages().catch(()=>{});
      alert(`Не удалось полностью очистить офлайн-данные: ${error.message}. Проверь хранилище в Boot diagnostics и повтори попытку.`);
      return;
    }
    setPackages([]);setCurrentPackage(null);setSelectedPoint(null);setFavoritesRevision(v=>v+1);
    setStorageStats({count:0,jsonBytes:0,mapBytes:0,mapCount:0,persisted:false});
  },[refreshPackages]);

  const exportGeoJson=useCallback(()=>{
    if(!currentPackage) return;
    downloadBlob(`${safeFileName(currentPackage.name)}.geojson`,'application/geo+json;charset=utf-8',JSON.stringify(currentPackage.geojson,null,2));
  },[currentPackage]);
  const exportGpx=useCallback(()=>{
    if(!currentPackage) return;
    downloadBlob(`${safeFileName(currentPackage.name)}.gpx`,'application/gpx+xml;charset=utf-8',geoJsonToGpx(currentPackage.geojson,currentPackage.name));
  },[currentPackage]);

  const mapUi=useMemo(()=>{
    const p=currentPackage;
    if(!p) return {button:'Скачать офлайн-карту',status:'Сначала выбери сохранённую гонку.',deleteHidden:true,disabled:true};
    if(offlineStorage.mapProgress) return {button:offlineStorage.mapProgress.button||'Офлайн-карта…',status:offlineStorage.mapProgress.text,deleteHidden:!p.offlineMap?.ready,disabled:true};
    if(offlineStorage.mapError) return {button:p.offlineMap?.ready?'Повторить обновление карты':'Повторить скачивание карты',status:`Не удалось скачать карту: ${offlineStorage.mapError.message}`,deleteHidden:!p.offlineMap?.ready,disabled:false};
    if(p.offlineMap?.ready){
      const layers=(p.offlineMap.vectorLayers||[]).map(v=>typeof v==='string'?v:v?.id).filter(Boolean);
      return {button:`Обновить карту (${formatBytes(p.offlineMap.bytes||0)})`,status:`Офлайн-подложка готова · ${p.offlineMap.tileCount||0} тайлов · ${layers.length} слоёв · ${formatBytes(p.offlineMap.bytes||0)} · z${p.offlineMap.minZoom}–${p.offlineMap.maxZoom}`,deleteHidden:false,disabled:false};
    }
    let status='Офлайн-подложка ещё не скачана.';
    try{const plan=buildDownloadPlan(p.geojson);status=`Будет скачано до ${plan.tiles.length} векторных тайлов · z${plan.minZoom}–${plan.maxZoom}. Размер зависит от района.`;}catch{}
    return {button:'Скачать офлайн-карту',status,deleteHidden:true,disabled:false};
  },[currentPackage,offlineStorage.mapProgress,offlineStorage.mapError]);

  const terrainUi=useMemo(()=>{
    const p=currentPackage;
    if(!p) return {button:'Рельеф карты',status:'Сначала выбери сохранённую гонку.',deleteHidden:true,disabled:true};
    if(offlineStorage.terrainProgress) return {button:offlineStorage.terrainProgress.button||'Рельеф…',status:offlineStorage.terrainProgress.text,deleteHidden:!p.terrain?.ready,disabled:true};
    if(p.terrain?.ready) return {button:`Обновить рельеф (${formatBytes(p.terrain.bytes||0)})`,status:`Рельеф готов · ${p.terrain.tileCount||0} DEM-тайлов · ${formatBytes(p.terrain.bytes||0)} · z${p.terrain.minZoom}–${p.terrain.maxZoom}`,deleteHidden:false,disabled:false};
    let status='Рельеф ещё не скачан.';
    try{const plan=buildTerrainDownloadPlan(p.geojson);status=`Отдельная загрузка DEM: до ${plan.tiles.length} тайлов · z${plan.minZoom}–${plan.maxZoom}. Может занимать много места.`;}catch{}
    return {button:'Рельеф карты',status,deleteHidden:true,disabled:false};
  },[currentPackage,offlineStorage.terrainProgress]);

  const mapSubtitle=useMemo(()=>{
    const p=currentPackage;if(!p)return 'Выбери сохранённую гонку';
    const om=p.offlineMap?.ready?p.offlineMap:null;
    return `${om?`ИСПОЛЬЗУЕТСЯ офлайн-подложка · ${om.vectorLayers?.length||0} слоёв · `:online?'онлайн-подложка · ':'офлайн · только локальная геометрия · '}${p.terrain?.ready?'рельеф ✓ · ':''}сохранено ${new Date(p.savedAt).toLocaleString()}`;
  },[currentPackage,online]);

  return {
    online,catalogStatus,catalogQuery,setCatalogQuery,visibleCatalog,downloadedIds,raceProgress,loadCatalog,downloadRace,
    packages,packageQuery,setPackageQuery,visiblePackages,storageStats,currentPackage,selectPackage,refreshPackages,
    importFiles,clearAll,
    selectedPoint,showPoint,setSelectedPoint,favorites,toggleFavorite,favoritesRevision,
    carPoint,saveCar,removeCar,userPos,requestLocation,geoStatus,geoClass,
    navStatus,setNavStatus,sharePoint,compass,compassEnabled,enableCompass,
    mapUi,terrainUi,mapSubtitle,mapDiag,setMapDiag,...offlineStorage,
    importYandex,exportGeoJson,exportGpx
  };
}
