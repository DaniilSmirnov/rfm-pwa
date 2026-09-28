import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ensureMapLibre } from '../hooks/useRfmApp.js';
import { renderMap, resizeActiveMap, updateLiveUserPosition } from '../map.js';
import { reportClientError } from '../app/telemetry.js';
import FallbackMap from './FallbackMap.jsx';
import './MapView.css';

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
    ensureMapLibre().then(()=>{if(!cancelled)setEngine('maplibre');}).catch(error=>{
      if(!cancelled){setEngine('fallback');setEngineError(error.message);app.setMapDiag(`Карта: SVG режим · ${error.message}`);}
    });
    return()=>{cancelled=true;};
  },[pkg?.id]);

  useEffect(()=>{
    const container=containerRef.current;
    if(!container||engine!=='maplibre'||!pkg)return undefined;
    const offlineMap=pkg.offlineMap?.ready?{...pkg.offlineMap,raceId:(pkg.offlineMap.storageId||pkg.id)}:null;
    const terrain=pkg.terrain?.ready?pkg.terrain:null;
    app.setMapDiag(`MapLibre ✓ · WebGL ✓${offlineMap?` · локальная подложка ${offlineMap.tileCount||0} тайлов`:''}`);
    try{
      renderMap(container,geojson,app.userPos,app.showPoint,{offlineMap,terrain,routePackage:pkg,onRouteClick,onMapError:message=>{
        reportClientError(new Error(message),'map');app.setMapDiag(`Ошибка карты: ${message}`);
      }});
    }catch(error){setEngine('fallback');setEngineError(error.message);app.setMapDiag(`Карта: SVG режим · ${error.message}`);}
    return()=>{resizeActiveMap();};
  },[engine,pkg?.id,pkg?.offlineMap?.storageId,pkg?.terrain?.storageId,geojson,onRouteClick]);

  useEffect(()=>{if(app.userPos)updateLiveUserPosition(app.userPos,{center:Boolean(app.userPos.__center)});},[app.userPos]);
  if(!pkg)return <div className="empty">Выбери сохранённую гонку</div>;
  if(engine==='fallback')return <><p className="muted small">Интерактивная карта недоступна: {engineError}. Показана схема гонки.</p><FallbackMap geojson={geojson} userPos={app.userPos} onPointClick={app.showPoint}/></>;
  if(engine==='loading')return <div className="empty" role="status">Загружаю карту…</div>;
  return <div ref={containerRef} className="map-engine" aria-label="Карта ралли"/>;
}

const sameMapInputs=(before,after)=>before.onRouteClick===after.onRouteClick
  &&before.app.currentPackage===after.app.currentPackage
  &&before.app.userPos===after.app.userPos
  &&before.app.carPoint?.savedAt===after.app.carPoint?.savedAt
  &&before.app.showPoint===after.app.showPoint
  &&before.app.setMapDiag===after.app.setMapDiag;

export default memo(MapLifecycle,sameMapInputs);
