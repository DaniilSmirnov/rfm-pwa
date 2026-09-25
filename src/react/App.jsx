import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRfmApp, ensureMapLibre, formatBytes } from './useRfmApp.js';
import { renderMap, updateLiveUserPosition } from '../map.js';
import { assetUrl } from '../rallyfans.js';
import {
  googleMapsDirections,yandexNavigatorLink,yandexWebFallback,mapsMeLink,mapsMeWebFallback,
  coordinateText,openCustomSchemeWithFallback
} from '../navigation.js';
import { pointFeatures, pointFromFeature } from '../app/point-list.js';
import { isFavoritePoint } from '../app/local-points.js';
import { renderSchedule } from '../app/schedule-ui.js';
import { renderRaceMedia } from '../app/race-media.js';
import { syncWalletPassesForPackage } from '../app/wallet-client.js';
import { showPointElevation, showRouteElevationProfile } from '../app/elevation-ui.js';
import { reportClientError } from '../app/telemetry.js';
import { formatDistance } from '../app/geo.js';
import { setupBootDiagnosticsUi } from '../app/boot-diagnostics.js';

function Portal({id,children}){
  const node=document.getElementById(id);
  return node?createPortal(children,node):null;
}

function useDomEvent(id,event,handler){
  useEffect(()=>{
    const el=document.getElementById(id);
    if(!el||!handler)return;
    el.addEventListener(event,handler);
    return()=>el.removeEventListener(event,handler);
  },[id,event,handler]);
}

function setProps(id,props){
  const el=document.getElementById(id);if(!el)return;
  for(const [key,value] of Object.entries(props)){
    if(key==='text') el.textContent=value??'';
    else if(key==='className') el.className=value;
    else if(key==='style') Object.assign(el.style,value||{});
    else el[key]=value;
  }
}

function Catalog({app}){
  if(!app.visibleCatalog.length){
    return <p className="muted">{app.catalogQuery.trim()?'Ничего не найдено.':'Нет гонок в пределах недели. Используй поиск.'}</p>;
  }
  return <>{[...app.visibleCatalog].reverse().map(r=>{
    const saved=app.downloadedIds.has(Number(r.id));
    const progress=app.raceProgress[r.id];
    return <article className="catalog-row" key={r.id} style={{'--race-bg':`url('${assetUrl(r.image||'')}')`}}>
      <div className="catalog-shade"></div>
      <div className="catalog-copy">
        <div className="catalog-tags"><span>{r.status_race||''}</span><span>{r.stage_race||''}</span></div>
        <span className="catalog-date">{r.dates||r.date_race||''}</span>
        <strong>{r.name||`Ралли #${r.id}`}</strong>
        <span>{[r.city_race_details,r.city_race].filter(Boolean).join(' · ')}</span>
      </div>
      <button className={`button ${saved?'downloaded':'primary'}`} data-race-id={Number(r.id)}
        onClick={()=>app.downloadRace(Number(r.id))}>
        {progress||(saved?'Обновить Rally Pack':'Скачать Rally Pack')}
      </button>
    </article>;
  })}</>;
}

function SavedPackages({app}){
  if(!app.packages.length) return <p className="muted">Пока ничего не скачано.</p>;
  if(!app.visiblePackages.length) return <p className="muted">Ничего не найдено.</p>;
  return <>{app.visiblePackages.map(p=>{
    const summary=[p.summary?.stage,p.summary?.dates,p.summary?.city].filter(Boolean).join(' · ');
    return <button className="package-row" key={p.id} onClick={()=>app.selectPackage(p.id)}>
      <span><strong className="package-name">{p.name}</strong><small className="package-meta">{summary||`${p.geojson?.features?.length||0} объектов · ${formatBytes(p.size)}`}</small></span>
      <img className="row-arrow" src="/assets/arrow-right.svg" alt="" />
    </button>;
  })}</>;
}

function PointList({app}){
  const pkg=app.currentPackage;
  const features=useMemo(()=>pointFeatures(pkg?.geojson),[pkg]);
  if(!pkg) return null;
  if(!features.length) return <p className="muted">Точек с координатами нет.</p>;
  return <>{features.map((feature,index)=>{
    const point=pointFromFeature(feature);
    const favorite=isFavoritePoint(point,pkg.id);
    const nav=(action,event)=>{
      event?.stopPropagation();
      if(action==='favorite'){app.toggleFavorite(point);return;}
      if(action==='mapsme'){openCustomSchemeWithFallback(mapsMeLink(point),mapsMeWebFallback());return;}
      if(action==='yandex'){openCustomSchemeWithFallback(yandexNavigatorLink(point),yandexWebFallback(point));return;}
      if(action==='google'){window.location.href=googleMapsDirections(point);return;}
      if(action==='share'){app.sharePoint(point);return;}
      if(action==='copy') navigator.clipboard?.writeText(coordinateText(point)).catch(()=>{});
    };
    return <article className="point-row" data-point-index={index} key={`${point.lat}:${point.lon}:${point.name}`} onClick={()=>app.showPoint(point)}>
      <div className="point-row-copy"><strong><img className="rfm-icon point-icon" src="/assets/location.svg" alt="" />{point.name}</strong><span className="muted">{coordinateText(point)}</span></div>
      <div className="point-nav-buttons">
        <button className={`button compact ${favorite?'downloaded':''}`} data-nav="favorite" onClick={e=>nav('favorite',e)}>{favorite?'★ Избранное':'☆ В избранное'}</button>
        <button className="button compact primary" data-nav="mapsme" onClick={e=>nav('mapsme',e)}>MAPS.ME</button>
        <button className="button compact" data-nav="yandex" onClick={e=>nav('yandex',e)}>Yandex</button>
        <button className="button compact" data-nav="google" onClick={e=>nav('google',e)}>Google Maps</button>
        <button className="button compact" data-nav="share" onClick={e=>nav('share',e)}>Поделиться</button>
        <button className="button compact" data-nav="copy" onClick={e=>nav('copy',e)}><img className="rfm-icon" src="/assets/document-copy.svg" alt="" />Копировать</button>
      </div>
    </article>;
  })}</>;
}

function Favorites({app}){
  if(!app.favorites.length) return <p className="muted small">Пока пусто.</p>;
  return <>{app.favorites.map(pt=><article className="favorite-row" key={pt.key||coordinateText(pt)}>
    <div className="point-row-copy" onClick={()=>app.showPoint(pt)}><strong>★ {pt.name}</strong><span className="muted">{coordinateText(pt)}</span></div>
    <div className="point-nav-buttons">
      <button className="button compact primary" onClick={()=>app.showPoint(pt)}>Открыть</button>
      <button className="button compact danger" onClick={()=>app.toggleFavorite(pt,false)}>Удалить</button>
    </div>
  </article>)}</>;
}

function RallyPackUpdate({pkg}){
  const pending=pkg?.pendingUpdate;
  const applied=pkg?.lastSmartUpdate;
  const changes=(pending?.changes||applied?.changes||[]).map(x=>x.label||x.key).join(' · ');
  if(!changes)return null;
  const title=pending?'ЕСТЬ ОБНОВЛЕНИЕ RALLY PACK':'RALLY PACK ОБНОВЛЁН В ФОНЕ';
  const reason=pending?.reason==='geometry'?'Изменилась геометрия: нужен полный Rally Pack update.'
    :pending?.reason==='yandex'?'Изменилась карта Yandex Constructor: нужен полный Rally Pack update.'
    :pending?'Не все новые материалы удалось скачать в фоне.':'Все необходимые данные были скачаны, поэтому изменения уже применены.';
  return <><strong>{changes}</strong><p className="muted small">{reason}{pending?' Старый офлайн-пакет остаётся активным.':''}</p><Portal id="rallyPackUpdateTitle">{title}</Portal></>;
}

function MapLifecycle({app}){
  useEffect(()=>{
    const pkg=app.currentPackage;
    const container=document.getElementById('map');
    if(!container){return;}
    if(!pkg){container.innerHTML='<div class="empty">Выбери сохранённую гонку</div>';app.setMapDiag('');return;}
    let cancelled=false;
    ensureMapLibre().then(()=>{
      if(cancelled)return;
      const om=pkg.offlineMap?.ready?{...pkg.offlineMap,raceId:(pkg.offlineMap.storageId||pkg.id)}:null;
      const terrain=pkg.terrain?.ready?pkg.terrain:null;
      const car=app.carPoint;
      const geojson=car?{...pkg.geojson,features:[...(pkg.geojson?.features||[]),{
        type:'Feature',properties:{kind:'local-car',name:'🚗 Машина'},geometry:{type:'Point',coordinates:[car.lon,car.lat]}
      }]}:pkg.geojson;
      app.setMapDiag(`MapLibre ✓ · WebGL ✓${om?` · локальная подложка ${om.tileCount||0} тайлов`:''}`);
      renderMap(container,geojson,app.userPos,app.showPoint,{
        offlineMap:om,terrain,
        onRouteClick:route=>showRouteElevationProfile(terrain,route),
        onMapError:message=>{reportClientError(new Error(message),'map');app.setMapDiag(`Ошибка карты: ${message}`);}
      });
    }).catch(error=>app.setMapDiag(`Карта недоступна: ${error.message}`));
    return()=>{cancelled=true;};
  },[app.currentPackage?.id,app.currentPackage?.offlineMap?.storageId,app.currentPackage?.terrain?.storageId,app.carPoint?.savedAt]);

  useEffect(()=>{
    if(app.userPos) updateLiveUserPosition(app.userPos,{center:Boolean(app.userPos.__center)});
  },[app.userPos]);
  return null;
}

function DomBindings({app}){
  useDomEvent('refreshCatalogBtn','click',app.loadCatalog);
  useDomEvent('clearBtn','click',app.clearAll);
  useDomEvent('downloadMapBtn','click',app.downloadMap);
  useDomEvent('downloadMapBtnTop','click',app.downloadMap);
  useDomEvent('deleteMapBtn','click',app.deleteMap);
  useDomEvent('deleteMapBtnTop','click',app.deleteMap);
  useDomEvent('downloadTerrainBtn','click',app.downloadTerrainForRace);
  useDomEvent('downloadTerrainBtnTop','click',app.downloadTerrainForRace);
  useDomEvent('deleteTerrainBtn','click',app.deleteTerrain);
  useDomEvent('deleteTerrainBtnTop','click',app.deleteTerrain);
  useDomEvent('importYandexBtn','click',app.importYandex);
  useDomEvent('saveCarBtn','click',app.saveCar);
  useDomEvent('carDeleteBtn','click',app.removeCar);
  useDomEvent('locateBtn','click',app.requestLocation);
  useDomEvent('exportGeoJsonBtn','click',app.exportGeoJson);
  useDomEvent('exportGpxBtn','click',app.exportGpx);
  useDomEvent('compassEnableBtn','click',app.enableCompass);

  useDomEvent('googleMapsBtn','click',()=>{if(app.selectedPoint)window.location.href=googleMapsDirections(app.selectedPoint);});
  useDomEvent('yandexMapsBtn','click',()=>{if(app.selectedPoint)openCustomSchemeWithFallback(yandexNavigatorLink(app.selectedPoint),yandexWebFallback(app.selectedPoint));});
  useDomEvent('mapsMeBtn','click',()=>{if(app.selectedPoint)openCustomSchemeWithFallback(mapsMeLink(app.selectedPoint),mapsMeWebFallback());});
  useDomEvent('sharePointBtn','click',()=>app.selectedPoint&&app.sharePoint(app.selectedPoint));
  useDomEvent('copyCoordsBtn','click',async()=>{
    if(!app.selectedPoint)return;
    const text=coordinateText(app.selectedPoint);
    try{await navigator.clipboard.writeText(text);app.setNavStatus(`Скопировано: ${text}`);}
    catch{app.setNavStatus(`Координаты: ${text}`);}
  });
  useDomEvent('favoritePointBtn','click',()=>app.selectedPoint&&app.toggleFavorite(app.selectedPoint));

  useDomEvent('carCompassBtn','click',async()=>{
    if(!app.carPoint)return;
    app.showPoint(app.carPoint);
    const details=document.getElementById('spectatorCompass');if(details)details.open=true;
    await app.enableCompass();
  });
  useDomEvent('carGoogleBtn','click',()=>{if(app.carPoint)window.location.href=googleMapsDirections(app.carPoint);});
  useDomEvent('carYandexBtn','click',()=>{if(app.carPoint)openCustomSchemeWithFallback(yandexNavigatorLink(app.carPoint),yandexWebFallback(app.carPoint));});
  useDomEvent('carShareBtn','click',()=>app.carPoint&&app.sharePoint(app.carPoint));

  useEffect(()=>{
    const input=document.getElementById('fileInput');
    if(!input)return;
    const handler=async e=>{await app.importFiles([...e.target.files]);e.target.value='';};
    input.addEventListener('change',handler);
    return()=>input.removeEventListener('change',handler);
  },[app.importFiles]);

  return null;
}

export default function App(){
  const app=useRfmApp();
  const pkg=app.currentPackage;

  useEffect(()=>{setupBootDiagnosticsUi();},[]);

  useEffect(()=>{
    setProps('networkBadge',{text:app.online?'онлайн':'офлайн',className:`badge ${app.online?'online':'offline'}`});
    setProps('raceDetails',{hidden:!pkg});
    setProps('pointActions',{hidden:!app.selectedPoint});
    setProps('carPointCard',{hidden:!app.carPoint});
    setProps('saveCarBtn',{text:app.carPoint?'Обновить координаты машины':'Запомнить машину'});
    setProps('carCoords',{text:app.carPoint?coordinateText(app.carPoint):''});
    setProps('carStatus',{text:app.carPoint?`Сохранено ${app.carPoint.savedAt?new Date(app.carPoint.savedAt).toLocaleString():''}`:'Сохрани текущие GPS-координаты машины.'});
    setProps('geoStatus',{text:app.geoStatus,className:`muted small ${app.geoClass}`});
    setProps('exportGpxBtn',{disabled:!pkg});setProps('exportGeoJsonBtn',{disabled:!pkg});
    setProps('importYandexBtn',{disabled:!pkg?.yandexMapEmbed,text:pkg?.yandexImport?.featureCount?`Yandex: ${pkg.yandexImport.featureCount} объектов ✓`:'Импорт из Yandex'});
    const hasUpdate=Boolean(pkg?.pendingUpdate?.changes?.length||pkg?.lastSmartUpdate?.changes?.length);
    setProps('rallyPackUpdatePanel',{hidden:!hasUpdate});
    setProps('favoritePointBtn',{className:`button ${pkg&&app.selectedPoint&&isFavoritePoint(app.selectedPoint,pkg.id)?'downloaded':''}`});
  },[app.online,pkg,app.selectedPoint,app.carPoint,app.geoStatus,app.geoClass,app.favoritesRevision]);

  useEffect(()=>{
    for(const id of ['downloadMapBtn','downloadMapBtnTop']) setProps(id,{text:app.mapUi.button,disabled:app.mapUi.disabled});
    for(const id of ['deleteMapBtn','deleteMapBtnTop']) setProps(id,{hidden:app.mapUi.deleteHidden,disabled:app.mapUi.disabled});
    for(const id of ['offlineMapStatus','offlineMapStatusTop']) setProps(id,{text:app.mapUi.status});
    for(const id of ['downloadTerrainBtn','downloadTerrainBtnTop']) setProps(id,{text:app.terrainUi.button,disabled:app.terrainUi.disabled});
    for(const id of ['deleteTerrainBtn','deleteTerrainBtnTop']) setProps(id,{hidden:app.terrainUi.deleteHidden,disabled:app.terrainUi.disabled});
    for(const id of ['terrainStatus','terrainStatusTop']) setProps(id,{text:app.terrainUi.status});
    setProps('offlineMapDiag',{hidden:!app.mapDiag,text:app.mapDiag});
  },[app.mapUi,app.terrainUi,app.mapDiag]);

  useEffect(()=>{
    const hero=document.getElementById('raceHero');
    const img=document.getElementById('raceImage');
    if(hero) hero.style.backgroundImage=pkg?.original?.image?`url('${assetUrl(pkg.original.image)}')`:'';
    if(img){
      if(pkg?.original?.image){img.src=assetUrl(pkg.original.image);img.hidden=false;img.onerror=()=>{img.hidden=true;};}
      else{img.hidden=true;img.removeAttribute('src');}
    }
    if(pkg){
      renderSchedule(pkg);
      renderRaceMedia(pkg);
      syncWalletPassesForPackage(pkg).catch(e=>console.warn('Wallet pass refresh failed',e));
    }else{
      const schedule=document.getElementById('scheduleList');if(schedule)schedule.innerHTML='';
      const media=document.getElementById('raceMedia');if(media)media.innerHTML='';
    }
  },[pkg?.id,pkg?.savedAt]);

  useEffect(()=>{
    if(!app.selectedPoint)return;
    showPointElevation(pkg?.terrain,app.selectedPoint).catch(()=>{});
    document.getElementById('pointActions')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  },[app.selectedPoint,pkg?.terrain?.storageId]);

  useEffect(()=>{
    const display=document.getElementById('compassDisplay');
    const arrow=document.getElementById('compassArrow');
    if(display)display.hidden=!app.compass;
    if(arrow&&app.compass)arrow.style.transform=`translate(-50%,-55%) rotate(${app.compass.relative}deg)`;
    setProps('compassEnableBtn',{text:app.compassEnabled?'Компас включён':'Включить компас'});
  },[app.compass,app.compassEnabled]);

  const stats=pkg?[
    ['Общая дистанция',pkg.summary?.totalDistance],['Боевых км',pkg.summary?.combatKm],['Дней',pkg.summary?.days]
  ].filter(x=>x[1]):[];

  const favSelected=Boolean(app.selectedPoint&&pkg&&isFavoritePoint(app.selectedPoint,pkg.id));

  return <>
    <DomBindings app={app}/>
    <MapLifecycle app={app}/>

    <Portal id="catalogStatus">{app.catalogStatus}</Portal>
    <Portal id="catalogList"><Catalog app={app}/></Portal>
    <Portal id="packageList"><SavedPackages app={app}/></Portal>
    <Portal id="storageStats"><><strong>{app.storageStats.count} гонок</strong><span className="muted">JSON: {formatBytes(app.storageStats.jsonBytes)} · карты: {formatBytes(app.storageStats.mapBytes)} ({app.storageStats.mapCount} тайлов) · persistent: {app.storageStats.persisted?'да':'нет'}</span></></Portal>

    <Portal id="raceKicker">{pkg?[pkg.summary?.category,pkg.summary?.stage].filter(Boolean).join(' / '):''}</Portal>
    <Portal id="raceTitle">{pkg?.name||''}</Portal>
    <Portal id="raceMeta">{pkg?[pkg.summary?.dates,pkg.summary?.city,pkg.summary?.status].filter(Boolean).join(' · '):''}</Portal>
    <Portal id="raceStats">{stats.map(([k,v])=><div key={k}><strong>{v}</strong><span>{k}</span></div>)}</Portal>
    <Portal id="rallyPackUpdateBody"><RallyPackUpdate pkg={pkg}/></Portal>

    <Portal id="mapTitle">{pkg?.name||'КАРТА РАЛЛИ'}</Portal>
    <Portal id="mapSubtitle">{app.mapSubtitle}</Portal>
    <Portal id="favoritesStatus">{app.favorites.length?`${app.favorites.length} сохранено для этой гонки.`:'Добавляй точки в избранное, чтобы они были всегда под рукой.'}</Portal>
    <Portal id="favoritesList"><Favorites app={app}/></Portal>
    <Portal id="pointList"><PointList app={app}/></Portal>

    <Portal id="pointName">{app.selectedPoint?.name||''}</Portal>
    <Portal id="pointCoords">{app.selectedPoint?coordinateText(app.selectedPoint):''}</Portal>
    <Portal id="navStatus">{app.navStatus}</Portal>
    <Portal id="favoritePointBtn">{favSelected?'★ В избранном':'☆ В избранное'}</Portal>

    <Portal id="compassDistance">{app.compass?formatDistance(app.compass.distance):'—'}</Portal>
    <Portal id="compassBearing">{app.compass?`Азимут ${Math.round(app.compass.bearing)}° · ${app.compass.direction}`:'—'}</Portal>
    <Portal id="compassStatus">{app.compass
      ?Number.isFinite(app.userPos?.accuracy)?`Курс ${app.compassEnabled?'активен':'по северу'} · точность геопозиции ±${Math.round(app.userPos.accuracy||0)} м`:'Компас включён.'
      :app.selectedPoint?'Нужна геопозиция для расчёта направления.':'Сначала выбери точку.'}</Portal>

    <Portal id="mapLegend"><><span><i style={{background:'#f3f5f7'}}></i>RallyFansMap</span><span><i style={{background:'#ffd21e'}}></i>Yandex Constructor</span><span><i style={{background:'#4da3ff'}}></i>вы</span></></Portal>
  </>;
}
