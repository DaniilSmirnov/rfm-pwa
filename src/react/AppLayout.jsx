import React, { useState } from 'react';
import packageMeta from '../../package.json';
import releaseMeta from '../../version.json';
import ElevationProfile from './ElevationProfile.jsx';
import CompassReadout from './CompassReadout.jsx';
import { googleMapsDirections, yandexNavigatorLink, yandexWebFallback, coordinateText, openCustomSchemeWithFallback } from '../navigation.js';
import { isFavoritePoint } from '../app/local-points.js';
import { formatDistance } from '../app/geo.js';
import { assetUrl } from '../rallyfans.js';
function OfflineActions({app,top=false}) {
  const variant=top?'Top':'';
  return <div className={top?'offline-cta':'actions'}>
    <button id={`downloadMapBtn${variant}`} className="button primary" disabled={app.mapUi.disabled} onClick={app.downloadMap}>{app.mapUi.button}</button>
    <button id={`deleteMapBtn${variant}`} className="button danger" hidden={app.mapUi.deleteHidden} disabled={app.mapUi.disabled} onClick={app.deleteMap}>Удалить карту</button>
    <button id={`downloadTerrainBtn${variant}`} className="button" disabled={app.terrainUi.disabled} onClick={app.downloadTerrainForRace}>{app.terrainUi.button}</button>
    <button id={`deleteTerrainBtn${variant}`} className="button danger" hidden={app.terrainUi.deleteHidden} disabled={app.terrainUi.disabled} onClick={app.deleteTerrain}>Удалить рельеф</button>
    <span id={`offlineMapStatus${variant}`} className="muted small">{app.mapUi.status}</span>
    <span id={`terrainStatus${variant}`} className="muted small">{app.terrainUi.status}</span>
  </div>;
}

function CatalogSection({app,catalogContent}) {
  return <section id="catalogSection" className="rfm-section legacy-more">
        <div className="section-head"><div><div className="block-title">ГОНКИ</div><p id="catalogStatus" className="muted">{app.catalogStatus}</p></div><input id="catalogSearch" className="search" placeholder="Карелия, Псков…" value={app.catalogQuery} onChange={e => app.setCatalogQuery(e.target.value)} /><button className="button primary" type="button" onClick={app.loadCatalog}>Обновить каталог</button></div>
        <div id="catalogList" className="catalog-list">{catalogContent}</div>
  </section>;
}

function SavedOfflineSections({app,packagesContent,statsContent}) {
  return <section id="savedRacesSection" className="grid two compact-grid legacy-more">
        <article className="rfm-section"><div className="section-head saved-head"><div><div className="block-title">СОХРАНЕНО ОФЛАЙН</div><div id="storageStats" className="stats">{statsContent}</div></div><input id="packageSearch" className="search" placeholder="Найти сохранённую гонку…" value={app.packageQuery} onChange={e => app.setPackageQuery(e.target.value)} /></div><div id="packageList" className="package-list">{packagesContent}</div><button id="clearBtn" className="button danger" onClick={app.clearAll}>Удалить все офлайн-данные</button></article>
        <article className="rfm-section"><div className="block-title">РУЧНОЙ ИМПОРТ</div><p className="muted">Запасной путь для GeoJSON/JSON.</p><div className="actions"><label className="button" htmlFor="fileInput">Импортировать файл</label><input id="fileInput" type="file" accept=".json,.geojson,application/json,application/geo+json" hidden multiple onChange={async e => {
              await app.importFiles([...e.target.files]);
              e.target.value = '';
            }} /></div></article>
  </section>;
}

export default function AppLayout({
  app,
  selectedRoute,
  onLogoClick,
  pointElevation,
  pointStageDistance,
  catalogContent,
  packagesContent,
  statsContent,
  pointListContent,
  favoritesContent,
  scheduleContent,
  mediaContent,
  mapContent,
  installControl,
  installPrompt,
  updateMessage
}) {
  const [compassOpen, setCompassOpen] = useState(false);
  const pkg = app.currentPackage;
  const favorite = Boolean(pkg && app.selectedPoint && isFavoritePoint(app.selectedPoint, pkg.id));
  const openYandex = point => openCustomSchemeWithFallback(yandexNavigatorLink(point), yandexWebFallback(point));
  const copyPoint = async point => {
    const text = coordinateText(point);
    try {
      await navigator.clipboard.writeText(text);
      app.setNavStatus(`Скопировано: ${text}`);
    } catch {
      app.setNavStatus(`Координаты: ${text}`);
    }
  };
  return <>
    <header className="topbar">
      <div className="header-brand"><img id="headerLogo" className="header-logo" src={`/rfm/icon.png?v=${String(packageMeta.version).replace(/\D/g, '')}`} alt="" onClick={onLogoClick} /><div><div className="brand-small">Rally Fans Map</div><h1>OFFLINE</h1></div></div>
      <div className="top-actions">{installControl}<span id="networkBadge" className={`badge ${app.online ? 'online' : 'offline'}`}>{app.online ? 'онлайн' : 'офлайн'}</span></div>
    </header>
    {installPrompt}

    <main>
      <CatalogSection app={app} catalogContent={catalogContent}/>

      <SavedOfflineSections app={app} packagesContent={packagesContent} statsContent={statsContent}/>

      <section id="raceDetails" className="race-page legacy-more" hidden={!pkg}>
        <div className="race-hero" style={{
          backgroundImage: pkg?.original?.image ? `url('${assetUrl(pkg.original.image)}')` : undefined
        }}><div className="race-hero-overlay" /><div className="race-hero-top"><div className="brand-small light">Rally Fans Map</div><div id="raceKicker" className="race-category">{pkg ? [pkg.summary?.category, pkg.summary?.stage].filter(Boolean).join(' / ') : ''}</div></div><div className="race-hero-bottom"><h2 id="raceTitle">{pkg?.name || ''}</h2><p id="raceMeta">{pkg ? [pkg.summary?.dates, pkg.summary?.city, pkg.summary?.status].filter(Boolean).join(' · ') : ''}</p></div></div>
        <div className="race-content"><div id="raceStats" className="race-stats">{pkg && [['Общая дистанция', pkg.summary?.totalDistance], ['Боевых км', pkg.summary?.combatKm], ['Дней', pkg.summary?.days]].filter(x => x[1]).map(([k, v]) => <div key={k}><strong>{v}</strong><span>{k}</span></div>)}</div>
          {Boolean(pkg?.pendingUpdate?.changes?.length || pkg?.lastSmartUpdate?.changes?.length) && <section className="rally-pack-update-panel"><div id="rallyPackUpdateTitle" className="block-title">{pkg.pendingUpdate ? 'ЕСТЬ ОБНОВЛЕНИЕ RALLY PACK' : 'RALLY PACK ОБНОВЛЁН В ФОНЕ'}</div><strong>{(pkg.pendingUpdate?.changes || pkg.lastSmartUpdate?.changes || []).map(item => item.label || item.key).join(' · ')}</strong><p className="muted small">{pkg.pendingUpdate ? 'Есть изменения материалов. Старый офлайн-пакет остаётся активным.' : 'Все необходимые данные были скачаны, поэтому изменения уже применены.'}</p></section>}
          <div className="race-actions-line"><button className="button" disabled={!pkg?.yandexMapEmbed} onClick={app.importYandex}>{pkg?.yandexImport?.featureCount ? `Yandex: ${pkg.yandexImport.featureCount} объектов ✓` : 'Импорт из Yandex'}</button></div>
          <OfflineActions app={app} top/>
          <div className="full-width-line" /><div className="block-title">РАСПИСАНИЕ</div><div id="scheduleList" className="schedule-list">{scheduleContent}</div><div id="raceMedia">{mediaContent}</div>
        </div>
      </section>

      <section id="mapSection" className="rfm-section map-card legacy-map">
        <div className="section-head"><div><div id="mapTitle" className="block-title">{pkg?.name || 'КАРТА РАЛЛИ'}</div><p id="mapSubtitle" className="muted">{app.mapSubtitle}</p></div><OfflineActions app={app}/></div>
        <div className="map" aria-label="offline rally map">{mapContent}</div>
        <section className="favorites-panel" aria-labelledby="favoritesTitle"><div className="section-head compact-section-head"><div><div id="favoritesTitle" className="block-title">ИЗБРАННЫЕ ТОЧКИ</div><p id="favoritesStatus" className="muted small">{app.favorites.length ? `${app.favorites.length} сохранено для этой гонки.` : 'Добавляй точки в избранное, чтобы они были всегда под рукой.'}</p></div></div><div id="favoritesList" className="favorites-list">{favoritesContent}</div></section>
        <section className="car-panel" aria-labelledby="carTitle"><div className="section-head compact-section-head"><div><div id="carTitle" className="block-title">ГДЕ МАШИНА?</div><p id="carStatus" className="muted small">{app.carPoint ? `Сохранено ${app.carPoint.savedAt ? new Date(app.carPoint.savedAt).toLocaleString() : ''}` : 'Сохрани текущие GPS-координаты машины.'}</p></div><button id="saveCarBtn" className="button" type="button" onClick={app.saveCar}>{app.carPoint ? 'Обновить координаты машины' : 'Запомнить машину'}</button></div>{app.carPoint && <div id="carPointCard" className="car-point-card"><div className="point-row-copy"><strong>🚗 Машина</strong><span id="carCoords" className="muted">{coordinateText(app.carPoint)}</span></div><div className="point-nav-buttons"><button id="carCompassBtn" className="button compact" onClick={async () => {
                setCompassOpen(true);
                app.showPoint(app.carPoint);
                await app.enableCompass();
              }}>Компас</button><button id="carGoogleBtn" className="button compact primary" onClick={() => window.location.href = googleMapsDirections(app.carPoint)}>Google Maps</button><button id="carYandexBtn" className="button compact" onClick={() => openYandex(app.carPoint)}>Yandex</button><button id="carShareBtn" className="button compact" onClick={() => app.sharePoint(app.carPoint)}>Поделиться</button><button id="carDeleteBtn" className="button compact danger" onClick={app.removeCar}>Удалить</button></div></div>}</section>
        <div className="map-export-actions"><div><div className="block-title">ЭКСПОРТ ОФЛАЙН</div><p className="muted small">Экспортирует текущую гонку без обращения к серверу.</p></div><div className="actions"><button id="exportGpxBtn" className="button" disabled={!pkg} onClick={app.exportGpx}>GPX</button><button id="exportGeoJsonBtn" className="button" disabled={!pkg} onClick={app.exportGeoJson}>GeoJSON</button></div></div>
        <div className="map-location-controls"><button id="locateBtn" className="button" onClick={app.requestLocation}><img className="rfm-icon" src="/assets/location.svg" alt="" />Показать где я</button><p id="geoStatus" className={`muted small ${app.geoClass}`}>{app.geoStatus}</p></div>
        <ElevationProfile route={selectedRoute} terrain={pkg?.terrain} /><div className="legend"><span><i style={{
              background: '#f3f5f7'
            }}></i>RallyFansMap</span><span><i style={{
              background: '#ffd21e'
            }}></i>Yandex Constructor</span><span><i style={{
              background: '#4da3ff'
            }}></i>вы</span></div><div className="full-width-line" />
        <details className="points-panel collapsible-section"><summary><span className="block-title">ГДЕ СМОТРЕТЬ?</span><span className="summary-chevron">⌄</span></summary><div className="collapsible-body"><p className="muted small">Точки можно открыть во внешнем навигаторе без доступа к геопозиции PWA.</p><div id="pointList" className="point-list">{pointListContent}</div></div></details>
        {app.selectedPoint && <aside id="pointActions" className="point-actions"><div className="point-actions-copy"><div className="eyebrow">выбранная точка</div><strong id="pointName">{app.selectedPoint.name}</strong><span id="pointCoords" className="muted">{coordinateText(app.selectedPoint)}</span></div><span id="pointStageDistance" className="muted small">{pointStageDistance ? `${pointStageDistance.stage.name}: ${formatDistance(pointStageDistance.distance.fromStart)} от старта · ${formatDistance(pointStageDistance.distance.toFinish)} до финиша` : ''}</span><div className="actions point-buttons"><button id="favoritePointBtn" className={`button ${favorite ? 'downloaded' : ''}`} onClick={() => app.toggleFavorite(app.selectedPoint)}>{favorite ? '★ В избранном' : '☆ В избранное'}</button><button id="mapsMeBtn" className="button primary" onClick={() => openCustomSchemeWithFallback(`mapsme://?ll=${app.selectedPoint.lat},${app.selectedPoint.lon}`, `https://maps.me/${app.selectedPoint.lat},${app.selectedPoint.lon}`)}>MAPS.ME</button><button id="yandexMapsBtn" className="button" onClick={() => openYandex(app.selectedPoint)}>Yandex Navigator</button><button id="googleMapsBtn" className="button" onClick={() => window.location.href = googleMapsDirections(app.selectedPoint)}>Google Maps</button><button id="sharePointBtn" className="button" onClick={() => app.sharePoint(app.selectedPoint)}>Поделиться</button><button id="copyCoordsBtn" className="button" onClick={() => copyPoint(app.selectedPoint)}>Копировать</button></div><p id="pointElevation" className="muted small">{pointElevation}</p><p id="navStatus" className="muted small">{app.navStatus}</p><details id="spectatorCompass" open={compassOpen} onToggle={e => setCompassOpen(e.currentTarget.open)} className="spectator-compass collapsible-section"><summary><span className="block-title">КОМПАС ЗРИТЕЛЯ</span><span className="summary-chevron">⌄</span></summary><div className="collapsible-body spectator-compass-body"><p className="muted small">Показывает направление и расстояние до выбранной точки прямо по положению телефона.</p><button id="compassEnableBtn" className="button" type="button" onClick={app.enableCompass}>{app.compassEnabled ? 'Компас включён' : 'Включить компас'}</button><CompassReadout point={app.selectedPoint} userPos={app.userPos}/></div></details></aside>}
      </section>
    </main>

    {updateMessage && <div className="update-banner" role="status">{updateMessage}</div>}
    <footer className="app-footer"><div className="brand-small">Rally Fans Map</div><div>Companion v{packageMeta.version} · {releaseMeta.codename}</div></footer>
  </>;
}
