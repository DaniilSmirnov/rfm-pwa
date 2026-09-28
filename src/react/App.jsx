import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CircleEllipsis, Map } from 'lucide-react';
import { useRfmApp, ensureMapLibre, formatBytes } from './useRfmApp.js';
import { renderMap, resizeActiveMap, updateLiveUserPosition } from '../map.js';
import { assetUrl } from '../rallyfans.js';
import {
  googleMapsDirections,yandexNavigatorLink,yandexWebFallback,mapsMeLink,mapsMeWebFallback,
  coordinateText,openCustomSchemeWithFallback
} from '../navigation.js';
import { pointFeatures, pointFromFeature } from '../app/point-list.js';
import { isFavoritePoint } from '../app/local-points.js';
import { syncWalletPassesForPackage } from '../app/wallet-client.js';
import { pointElevationText } from '../app/elevation-ui.js';
import { reportClientError } from '../app/telemetry.js';
import TodayTab from './TodayTab.jsx';
import { nearestStageDistance } from '../app/point-stage-distance.js';
import SafetyGate from './SafetyGate.jsx';
import SettingsTab from './SettingsTab.jsx';
import PwaInstallPrompt from './PwaInstallPrompt.jsx';
import AppLayout from './AppLayout.jsx';
import ScheduleList from './ScheduleList.jsx';
import RaceMedia from './RaceMedia.jsx';
import CrewResults from './CrewResults.jsx';
import BootDiagnostics from './BootDiagnostics.jsx';
import { hasSafetyConsent, saveSafetyConsent } from '../app/safety-consent.js';
import { raceHasFinished } from '../app/today-summary.js';
import FallbackMap from './FallbackMap.jsx';

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

function MapLifecycle({app,onRouteClick}){
  const containerRef=useRef(null);
  const [engine,setEngine]=useState('loading');
  const [engineError,setEngineError]=useState('');
  const pkg=app.currentPackage;
  const geojson=useMemo(()=>{
    const car=app.carPoint;
    return car?{...pkg?.geojson,features:[...(pkg?.geojson?.features||[]),{type:'Feature',properties:{kind:'local-car',name:'🚗 Машина'},geometry:{type:'Point',coordinates:[car.lon,car.lat]}}]}:pkg?.geojson;
  },[pkg?.geojson,app.carPoint?.savedAt]);
  useEffect(()=>{
    let cancelled=false;
    if(!pkg){setEngine('empty');setEngineError('');app.setMapDiag('');return undefined;}
    setEngine('loading');
    ensureMapLibre().then(()=>{if(!cancelled)setEngine('maplibre');}).catch(error=>{if(!cancelled){setEngine('fallback');setEngineError(error.message);app.setMapDiag(`Карта: SVG режим · ${error.message}`);}});
    return()=>{cancelled=true;};
  },[pkg?.id]);

  useEffect(()=>{
    const container=containerRef.current;
    if(!container||engine!=='maplibre'||!pkg)return undefined;
    const offlineMap=pkg.offlineMap?.ready?{...pkg.offlineMap,raceId:(pkg.offlineMap.storageId||pkg.id)}:null;
    const terrain=pkg.terrain?.ready?pkg.terrain:null;
    app.setMapDiag(`MapLibre ✓ · WebGL ✓${offlineMap?` · локальная подложка ${offlineMap.tileCount||0} тайлов`:''}`);
    try{renderMap(container,geojson,app.userPos,app.showPoint,{offlineMap,terrain,routePackage:pkg,onRouteClick,onMapError:message=>{reportClientError(new Error(message),'map');app.setMapDiag(`Ошибка карты: ${message}`);}});}
    catch(error){setEngine('fallback');setEngineError(error.message);app.setMapDiag(`Карта: SVG режим · ${error.message}`);}
    return()=>{resizeActiveMap();};
  },[engine,pkg?.id,pkg?.offlineMap?.storageId,pkg?.terrain?.storageId,geojson,onRouteClick]);

  useEffect(()=>{
    if(app.userPos) updateLiveUserPosition(app.userPos,{center:Boolean(app.userPos.__center)});
  },[app.userPos]);
  if(!pkg)return <div className="empty">Выбери сохранённую гонку</div>;
  if(engine==='fallback')return <><p className="muted small">Интерактивная карта недоступна: {engineError}. Показана схема гонки.</p><FallbackMap geojson={geojson} userPos={app.userPos} onPointClick={app.showPoint}/></>;
  if(engine==='loading')return <div className="empty" role="status">Загружаю карту…</div>;
  return <div ref={containerRef} className="map-engine" aria-label="Карта ралли"/>;
}
const StableMapLifecycle=memo(MapLifecycle,(before,after)=>
  before.onRouteClick===after.onRouteClick
  &&before.app.currentPackage===after.app.currentPackage
  &&before.app.userPos===after.app.userPos
  &&before.app.carPoint?.savedAt===after.app.carPoint?.savedAt
  &&before.app.showPoint===after.app.showPoint
  &&before.app.setMapDiag===after.app.setMapDiag
);

const tabs=[
  {key:'today',label:'Сегодня',Icon:CalendarDays},
  {key:'map',label:'Карта',Icon:Map},
  {key:'more',label:'Ещё',Icon:CircleEllipsis}
];
function readTab(){return new URLSearchParams(location.search).get('tab')||'today';}
function MoreTab({onSettings}){const go=id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});return <section className="more-menu"><button className="more-menu-row" onClick={()=>go('catalogSection')}><strong>Мои гонки</strong><span>Каталог и сохранённые Rally Pack</span></button><button className="more-menu-row" onClick={onSettings}><strong>Настройки и диагностика</strong><span>Настройки приложения и состояние диагностики</span></button></section>;}

export default function App(){
  const app=useRfmApp();
  const pkg=app.currentPackage;
  const pointStageDistance=useMemo(
    ()=>nearestStageDistance(pkg,app.selectedPoint),[pkg,app.selectedPoint]
  );
  const [tab,setTab]=useState(readTab());
  const [moreScreen,setMoreScreen]=useState('menu');
  const [crewResultsOpen,setCrewResultsOpen]=useState(false);
  const [selectedRoute,setSelectedRoute]=useState(null);
  const [pointElevation,setPointElevation]=useState('Высота: выбери точку.');
  const [diagnosticsOpen,setDiagnosticsOpen]=useState(false);
  const [safetyAccepted,setSafetyAccepted]=useState(()=>hasSafetyConsent(pkg));
  const [clock,setClock]=useState(()=>new Date());
  const [updateMessage,setUpdateMessage]=useState('');
  const scrollPositions=useRef({});
  const activeScrollKey=tab==='more'?`more:${moreScreen}`:tab;
  const restoreScrollKey=useRef(activeScrollKey);
  const activate=next=>{scrollPositions.current[activeScrollKey]=window.scrollY;restoreScrollKey.current=next==='more'?`more:${moreScreen}`:next;const url=new URL(location.href);url.searchParams.set('tab',next);history.pushState({tab:next},'',url);setTab(next);if(next!=='more')setMoreScreen('menu');};

  useEffect(()=>{document.body.dataset.activeTab=tab;document.body.dataset.moreScreen=moreScreen;},[tab,moreScreen]);

  useEffect(()=>{
    setSafetyAccepted(hasSafetyConsent(pkg));
  },[pkg?.id,pkg?.original?.safety_leaflet]);

  useEffect(()=>{const timer=setInterval(()=>setClock(new Date()),30000);return()=>clearInterval(timer);},[]);

  useEffect(()=>{
    const onUpdate=event=>setUpdateMessage(event.detail?.message||'Обновляю приложение…');
    window.addEventListener('rfm:service-worker-update',onUpdate);
    return()=>window.removeEventListener('rfm:service-worker-update',onUpdate);
  },[]);

  useEffect(()=>{
    const update=()=>{const next=new URLSearchParams(location.search).get('tab')||'today';scrollPositions.current[activeScrollKey]=window.scrollY;setMoreScreen('menu');setTab(next);restoreScrollKey.current=next;};
    window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);
  },[activeScrollKey]);

  useEffect(()=>{
    const save=()=>{scrollPositions.current[activeScrollKey]=window.scrollY;};
    window.addEventListener('scroll',save,{passive:true});return()=>window.removeEventListener('scroll',save);
  },[activeScrollKey]);

  useLayoutEffect(()=>{
    const key=restoreScrollKey.current;let second=0;
    const first=requestAnimationFrame(()=>{window.scrollTo(0,scrollPositions.current[key]||0);second=requestAnimationFrame(()=>window.scrollTo(0,scrollPositions.current[key]||0));});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[activeScrollKey]);

  useEffect(()=>{
    if(tab==='map') requestAnimationFrame(()=>resizeActiveMap());
  },[tab]);

  const logoTaps=useRef([]);
  const handleLogoClick=()=>{
    const now=Date.now();
    logoTaps.current=logoTaps.current.filter(timestamp=>now-timestamp<2500);
    logoTaps.current.push(now);
    if(logoTaps.current.length>=5){logoTaps.current=[];setDiagnosticsOpen(true);}
  };

  useEffect(()=>{if(pkg) syncWalletPassesForPackage(pkg).catch(e=>console.warn('Wallet pass refresh failed',e));},[pkg?.id,pkg?.savedAt]);

  useEffect(()=>{
    let cancelled=false;
    if(!app.selectedPoint){setPointElevation('Высота: выбери точку.');return undefined;}
    pointElevationText(pkg?.terrain,app.selectedPoint).then(text=>{if(!cancelled)setPointElevation(text);});
    document.getElementById('pointActions')?.scrollIntoView({behavior:'smooth',block:'nearest'});
    return()=>{cancelled=true;};
  },[app.selectedPoint,pkg?.terrain?.storageId]);

  useEffect(()=>setSelectedRoute(null),[pkg?.id]);


  const requiresSafety=tab==='map'&&!safetyAccepted;
  useEffect(()=>{document.body.dataset.safetyGate=requiresSafety?'true':'false';},[requiresSafety]);
  const acceptSafety=()=>{saveSafetyConsent(pkg);setSafetyAccepted(true);};
  const openSettings=()=>{scrollPositions.current[activeScrollKey]=window.scrollY;restoreScrollKey.current='more:settings';setMoreScreen('settings');};
  const closeSettings=()=>{scrollPositions.current[activeScrollKey]=window.scrollY;restoreScrollKey.current='more:menu';setMoreScreen('menu');};
  const openCrewResults=()=>setCrewResultsOpen(true);

  return <>
    <AppLayout app={app} selectedRoute={selectedRoute} onLogoClick={handleLogoClick} pointElevation={pointElevation} pointStageDistance={pointStageDistance}
      installControl={<PwaInstallPrompt compact active={tab==='today'}/>} installPrompt={<PwaInstallPrompt active={tab==='today'}/>} updateMessage={updateMessage}
      mapContent={<StableMapLifecycle app={app} onRouteClick={setSelectedRoute}/>} catalogContent={<Catalog app={app}/>} packagesContent={<SavedPackages app={app}/>} statsContent={<><strong>{app.storageStats.count} гонок</strong><span className="muted">JSON: {formatBytes(app.storageStats.jsonBytes)} · карты: {formatBytes(app.storageStats.mapBytes)} ({app.storageStats.mapCount} тайлов) · persistent: {app.storageStats.persisted?'да':'нет'}</span></>}
      pointListContent={<PointList app={app}/>} favoritesContent={<Favorites app={app}/>} scheduleContent={pkg&&<ScheduleList pkg={pkg}/>} mediaContent={<RaceMedia pkg={pkg}/>}/>
    <BootDiagnostics open={diagnosticsOpen} onClose={()=>setDiagnosticsOpen(false)}/>
    <div className="react-tab-content">{tab==='today'&&<TodayTab app={app} onMap={()=>activate('map')} onResults={openCrewResults}/>} {tab==='more'&&(moreScreen==='settings'?<SettingsTab app={app} onBack={closeSettings} onDiagnostics={()=>setDiagnosticsOpen(true)}/>:<MoreTab onSettings={openSettings}/>)}</div>
    <nav className="bottom-tabbar" aria-label="Основная навигация">{tabs.map(({key,label,Icon})=><button key={key} className={tab===key?'active':''} aria-current={tab===key?'page':undefined} onClick={()=>activate(key)}><Icon aria-hidden="true" size={21} strokeWidth={tab===key?2.4:1.8}/><b>{label}</b></button>)}</nav>

    <CrewResults pkg={pkg&&(!raceHasFinished(pkg,clock)||pkg.crewResults?.eventResults?.length)?pkg:null} open={crewResultsOpen} onOpen={openCrewResults} onClose={()=>setCrewResultsOpen(false)}/>

    {requiresSafety&&<SafetyGate pkg={pkg} onAccept={acceptSafety}/>}
  </>;
}
