import React, { useState } from 'react';
import { googleMapsDirections,yandexNavigatorLink,yandexWebFallback,coordinateText,openCustomSchemeWithFallback } from '../navigation.js';
import { isFavoritePoint } from '../app/local-points.js';
import { formatDistance } from '../app/geo.js';
import OfflineMapActions from '../components/OfflineMapActions.jsx';
import ElevationProfile from '../components/ElevationProfile.jsx';
import CompassReadout from '../components/CompassReadout.jsx';
import '../components/MapView.css';

export default function MapView({app,selectedRoute,pointElevation,pointStageDistance,pointsContent,favoritesContent,mapContent}){
  const [compassOpen,setCompassOpen]=useState(false);
  const pkg=app.currentPackage;
  const favorite=Boolean(pkg&&app.selectedPoint&&isFavoritePoint(app.selectedPoint,pkg.id));
  const openYandex=point=>openCustomSchemeWithFallback(yandexNavigatorLink(point),yandexWebFallback(point));
  const copyPoint=async point=>{
    const text=coordinateText(point);
    try{await navigator.clipboard.writeText(text);app.setNavStatus(`Скопировано: ${text}`);}
    catch{app.setNavStatus(`Координаты: ${text}`);}
  };
  return <section id="mapSection" className="rfm-section map-card legacy-map">
    <div className="section-head"><div><div id="mapTitle" className="block-title">{pkg?.name||'КАРТА РАЛЛИ'}</div><p id="mapSubtitle" className="muted">{app.mapSubtitle}</p></div><OfflineMapActions app={app}/></div>
    <div className="map" aria-label="offline rally map">{mapContent}</div>
    <section className="favorites-panel" aria-labelledby="favoritesTitle"><div className="section-head compact-section-head"><div><div id="favoritesTitle" className="block-title">ИЗБРАННЫЕ ТОЧКИ</div><p id="favoritesStatus" className="muted small">{app.favorites.length?`${app.favorites.length} сохранено для этой гонки.`:'Добавляй точки в избранное, чтобы они были всегда под рукой.'}</p></div></div><div id="favoritesList" className="favorites-list">{favoritesContent}</div></section>
    <section className="car-panel" aria-labelledby="carTitle"><div className="section-head compact-section-head"><div><div id="carTitle" className="block-title">ГДЕ МАШИНА?</div><p id="carStatus" className="muted small">{app.carPoint?`Сохранено ${app.carPoint.savedAt?new Date(app.carPoint.savedAt).toLocaleString():''}`:'Сохрани текущие GPS-координаты машины.'}</p></div><button id="saveCarBtn" className="button" type="button" onClick={app.saveCar}>{app.carPoint?'Обновить координаты машины':'Запомнить машину'}</button></div>
      {app.carPoint&&<div id="carPointCard" className="car-point-card"><div className="point-row-copy"><strong>🚗 Машина</strong><span id="carCoords" className="muted">{coordinateText(app.carPoint)}</span></div><div className="point-nav-buttons">
        <button id="carCompassBtn" className="button compact" onClick={async()=>{setCompassOpen(true);app.showPoint(app.carPoint);await app.enableCompass();}}>Компас</button>
        <button id="carGoogleBtn" className="button compact primary" onClick={()=>window.location.href=googleMapsDirections(app.carPoint)}>Google Maps</button>
        <button id="carYandexBtn" className="button compact" onClick={()=>openYandex(app.carPoint)}>Yandex</button>
        <button id="carShareBtn" className="button compact" onClick={()=>app.sharePoint(app.carPoint)}>Поделиться</button>
        <button id="carDeleteBtn" className="button compact danger" onClick={app.removeCar}>Удалить</button>
      </div></div>}
    </section>
    <div className="map-export-actions"><div><div className="block-title">ЭКСПОРТ ОФЛАЙН</div><p className="muted small">Экспортирует текущую гонку без обращения к серверу.</p></div><div className="actions"><button id="exportGpxBtn" className="button" disabled={!pkg} onClick={app.exportGpx}>GPX</button><button id="exportGeoJsonBtn" className="button" disabled={!pkg} onClick={app.exportGeoJson}>GeoJSON</button></div></div>
    <div className="map-location-controls"><button id="locateBtn" className="button" onClick={app.requestLocation}><img className="rfm-icon" src="/assets/location.svg" alt=""/>Показать где я</button><p id="geoStatus" className={`muted small ${app.geoClass}`}>{app.geoStatus}</p></div>
    <ElevationProfile route={selectedRoute} terrain={pkg?.terrain}/>
    <div className="legend"><span><i style={{background:'#f3f5f7'}}/>RallyFansMap</span><span><i style={{background:'#ffd21e'}}/>Yandex Constructor</span><span><i style={{background:'#4da3ff'}}/>вы</span></div><div className="full-width-line"/>
    <details className="points-panel collapsible-section"><summary><span className="block-title">ГДЕ СМОТРЕТЬ?</span><span className="summary-chevron">⌄</span></summary><div className="collapsible-body"><p className="muted small">Точки можно открыть во внешнем навигаторе без доступа к геопозиции PWA.</p><div id="pointList" className="point-list">{pointsContent}</div></div></details>
    {app.selectedPoint&&<aside id="pointActions" className="point-actions">
      <div className="point-actions-copy"><div className="eyebrow">выбранная точка</div><strong id="pointName">{app.selectedPoint.name}</strong><span id="pointCoords" className="muted">{coordinateText(app.selectedPoint)}</span></div>
      <span id="pointStageDistance" className="muted small">{pointStageDistance?`${pointStageDistance.stage.name}: ${formatDistance(pointStageDistance.distance.fromStart)} от старта · ${formatDistance(pointStageDistance.distance.toFinish)} до финиша`:''}</span>
      <div className="actions point-buttons"><button id="favoritePointBtn" className={`button ${favorite?'downloaded':''}`} onClick={()=>app.toggleFavorite(app.selectedPoint)}>{favorite?'★ В избранном':'☆ В избранное'}</button>
        <button id="mapsMeBtn" className="button primary" onClick={()=>openCustomSchemeWithFallback(`mapsme://?ll=${app.selectedPoint.lat},${app.selectedPoint.lon}`,`https://maps.me/${app.selectedPoint.lat},${app.selectedPoint.lon}`)}>MAPS.ME</button>
        <button id="yandexMapsBtn" className="button" onClick={()=>openYandex(app.selectedPoint)}>Yandex Navigator</button>
        <button id="googleMapsBtn" className="button" onClick={()=>window.location.href=googleMapsDirections(app.selectedPoint)}>Google Maps</button>
        <button id="sharePointBtn" className="button" onClick={()=>app.sharePoint(app.selectedPoint)}>Поделиться</button>
        <button id="copyCoordsBtn" className="button" onClick={()=>void copyPoint(app.selectedPoint)}>Копировать</button>
      </div>
      <p id="pointElevation" className="muted small">{pointElevation}</p><p id="navStatus" className="muted small">{app.navStatus}</p>
      <details id="spectatorCompass" open={compassOpen} onToggle={event=>setCompassOpen(event.currentTarget.open)} className="spectator-compass collapsible-section"><summary><span className="block-title">КОМПАС ЗРИТЕЛЯ</span><span className="summary-chevron">⌄</span></summary>
        <div className="collapsible-body spectator-compass-body"><p className="muted small">Показывает направление и расстояние до выбранной точки прямо по положению телефона.</p><button id="compassEnableBtn" className="button" type="button" onClick={app.enableCompass}>{app.compassEnabled?'Компас включён':'Включить компас'}</button><CompassReadout point={app.selectedPoint} userPos={app.userPos}/></div>
      </details>
    </aside>}
  </section>;
}
