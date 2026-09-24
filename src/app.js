import * as maplibregl from '/vendor/maplibre-gl/maplibre-gl.mjs';
window.maplibregl = maplibregl;
import { savePackage, getAllPackages, deleteAllPackages, getPackage, clearMapTiles, getMapStorageStats } from './db.js';
import { normalizePackage } from './normalize.js';
import { renderMap, updateLiveUserPosition } from './map.js';
import { checkApiHealth, fetchRaceCatalog, fetchRace, raceDetailToPackage, cacheRaceAssets, assetUrl, enrichPackageWithYandex } from './rallyfans.js';
import { normalizePoint, googleMapsDirections, yandexNavigatorLink, yandexWebFallback, mapsMeLink, mapsMeWebFallback, coordinateText, openCustomSchemeWithFallback } from './navigation.js';
import { downloadOfflineMap, removeOfflineMap, discardOfflineMapRevision, buildDownloadPlan } from './offline-map.js';
import { xmlEsc, safeFileName, geoJsonToGpx } from './app/export.js';
import { startOfLocalDay, raceDateRange, distanceFromTodayDays, raceWithinWeek, pickDefaultRace } from './app/catalog-dates.js';
import { distanceMeters, bearingDegrees, formatDistance, compassDirection } from './app/geo.js';
import { stageIdentity } from './app/schedule.js';
import { subscribedStageKeys, setStageSubscribed, walletStageKeys, setWalletStageAdded } from './app/preferences.js';
import { setupPwaInstall, isIOSDevice } from './app/pwa.js';
import { setupPushUi, getPushSubscription, refreshPushUi, setPushStatus, scheduleRaceReminders, scheduleAllSavedReminders, enablePushNotifications } from './app/push-client.js';
import { syncWalletStage, syncWalletPassesForPackage } from './app/wallet-client.js';
import { FAVORITES_KEY, pointKey, favoritesForPackage, isFavoritePoint, setFavoritePoint, loadCarPoint, saveCarPoint, deleteCarPoint } from './app/local-points.js';
import { ensurePersistentStorage, setupPeriodicBackgroundSync, setupServiceWorkerUpdates } from './app/runtime.js';
import { renderPointList as renderPointListUi } from './app/point-list.js';
import { initRaceMediaModal, renderRaceMedia } from './app/race-media.js';

const $ = id => document.getElementById(id);
let currentPackageId = null;
let userPos = null;
let geoWatchId = null;
let catalog = [];
let selectedPoint = null;
let compassHeading = null;
let compassListening = false;
const WALLET_STAGE_FEATURE_ENABLED=false;

setupPwaInstall();
setupPushUi();
initRaceMediaModal();

function downloadBlob(filename,type,text){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderFavorites(p){
  const root=$('favoritesList'), status=$('favoritesStatus');
  if(!root) return;
  const list=favoritesForPackage(p?.id);
  if(status) status.textContent=list.length?`${list.length} сохранено для этой гонки.`:'Добавляй точки в избранное, чтобы они были всегда под рукой.';
  if(!list.length){root.innerHTML='<p class="muted small">Пока пусто.</p>';return;}
  root.innerHTML=list.map((pt,i)=>`<article class="favorite-row" data-favorite-index="${i}">
    <div class="point-row-copy"><strong>★ ${esc(pt.name)}</strong><span class="muted">${esc(coordinateText(pt))}</span></div>
    <div class="point-nav-buttons"><button class="button compact primary" data-favorite-open>Открыть</button><button class="button compact danger" data-favorite-remove>Удалить</button></div>
  </article>`).join('');
  root.querySelectorAll('.favorite-row').forEach((row,i)=>{
    const pt=list[i];
    row.querySelector('[data-favorite-open]')?.addEventListener('click',()=>showPointActions(pt));
    row.querySelector('[data-favorite-remove]')?.addEventListener('click',()=>{
      setFavoritePoint(pt,false,p.id);renderFavorites(p);renderPointList(p);syncFavoriteButton();
    });
  });
}
function renderCarPoint(){
  const pt=loadCarPoint(), card=$('carPointCard'), status=$('carStatus'), coords=$('carCoords');
  if(!card) return;
  card.hidden=!pt;
  if(pt){
    coords.textContent=coordinateText(pt);
    if(status) status.textContent=`Сохранено ${pt.savedAt?new Date(pt.savedAt).toLocaleString():''}`;
    if($('saveCarBtn')) $('saveCarBtn').textContent='Обновить координаты машины';
  }else{
    if(status) status.textContent='Сохрани текущие GPS-координаты машины.';
    if($('saveCarBtn')) $('saveCarBtn').textContent='Запомнить машину';
  }
}
function syncFavoriteButton(){
  const btn=$('favoritePointBtn');
  if(!btn) return;
  const favorite=Boolean(selectedPoint&&currentPackageId&&isFavoritePoint(selectedPoint,currentPackageId));
  btn.textContent=favorite?'★ В избранном':'☆ В избранное';
  btn.classList.toggle('downloaded',favorite);
}

async function ensureMapLibre(){
  if(!window.maplibregl) throw new Error('MapLibre 6.10.0 ESM не загрузился с CDN');
  if(typeof window.maplibregl.supported==='function' && !window.maplibregl.supported()) throw new Error('WebGL2 недоступен в этом браузере/PWA');
  return window.maplibregl;
}

const esc = s => String(s ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const asArray = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
function fmtBytes(n=0) { if (n<1024) return `${n} Б`; if(n<1024**2) return `${(n/1024).toFixed(1)} КБ`; return `${(n/1024**2).toFixed(1)} МБ`; }

async function sharePoint(point) {
  if(!point) return false;
  const title=point.name || 'Точка RallyFans Map';
  const coords=coordinateText(point);
  const url=yandexWebFallback(point);
  const data={title,text:`${title}\n${coords}`,url};
  try {
    if(navigator.share){
      await navigator.share(data);
      return true;
    }
  } catch(e) {
    if(e?.name==='AbortError') return false;
  }
  const fallback=`${title}\n${coords}\n${url}`;
  try {
    await navigator.clipboard.writeText(fallback);
    return true;
  } catch {
    return false;
  }
}

function updateNetwork() { const online=navigator.onLine; $('networkBadge').textContent=online?'онлайн':'офлайн'; $('networkBadge').className=`badge ${online?'online':'offline'}`; }
window.addEventListener('online',()=>{ updateNetwork(); loadCatalog(); });
window.addEventListener('offline',updateNetwork); updateNetwork();

async function refreshList() {
  const pkgs = (await getAllPackages()).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
  const list=$('packageList'); list.innerHTML='';
  const q=($('packageSearch')?.value||'').trim().toLowerCase();
  let visible;
  if(q){
    visible=pkgs.filter(p=>[
      p.name,p.summary?.stage,p.summary?.dates,p.summary?.city,p.summary?.category,p.summary?.status
    ].some(v=>String(v||'').toLowerCase().includes(q)));
  } else {
    const near=pickDefaultRace(pkgs.filter(raceWithinWeek));
    visible=near?[near]:(pkgs[0]?[pkgs[0]]:[]);
  }

  if(!pkgs.length) list.innerHTML='<p class="muted">Пока ничего не скачано.</p>';
  else if(!visible.length) list.innerHTML='<p class="muted">Ничего не найдено.</p>';

  for(const p of visible){
    const node=$('packageTpl').content.cloneNode(true); const row=node.querySelector('.package-row');
    node.querySelector('.package-name').textContent=p.name;
    const summary=[p.summary?.stage,p.summary?.dates,p.summary?.city].filter(Boolean).join(' · ');
    node.querySelector('.package-meta').textContent=summary || `${p.geojson?.features?.length||0} объектов · ${fmtBytes(p.size)}`;
    row.onclick=()=>selectPackage(p.id); list.appendChild(node);
  }

  const total=pkgs.reduce((s,p)=>s+(p.size||0),0); const mapStats=await getMapStorageStats();
  let persisted=false; try{ persisted=Boolean(await navigator.storage?.persisted?.()); }catch{}
  $('storageStats').innerHTML=`<strong>${pkgs.length} гонок</strong><span class="muted">JSON: ${fmtBytes(total)} · карты: ${fmtBytes(mapStats.bytes)} (${mapStats.count} тайлов) · persistent: ${persisted?'да':'нет'}</span>`;

  if (!currentPackageId && visible[0]) selectPackage(visible[0].id);
  renderCatalog();
}

function renderPointList(pkg){
  return renderPointListUi(pkg,{
    onSelectPoint:showPointActions,
    onShare:sharePoint,
    onFavoriteChange:()=>{
      renderFavorites(pkg);
      syncFavoriteButton();
    }
  });
}

function renderSchedule(p){
  const schedule=asArray(p.original?.schedule);
  const root=$('scheduleList'); root.innerHTML='';
  if(!schedule.length){ root.innerHTML='<p class="muted">Расписание отсутствует.</p>'; return; }

  const subscribed=subscribedStageKeys(p);
  const walletAdded=walletStageKeys(p);
  const showWallet=WALLET_STAGE_FEATURE_ENABLED && isIOSDevice();

  for(const item of schedule){
    const events=asArray(item.events);
    const stage=stageIdentity(item);
    const isSubscribed=Boolean(stage && subscribed.has(stage.key));
    const isInWallet=Boolean(stage && walletAdded.has(stage.key));

    const node=document.createElement('article');
    node.className='schedule-item';
    node.innerHTML=`${item.date?`<div class="date-header">${esc(item.date)}</div>`:''}
      <div class="schedule-location-row">
        <div class="location">${esc(item.location||'Событие')}</div>
        ${stage?`<div class="stage-actions">
          <button class="button compact stage-push-toggle ${isSubscribed?'subscribed':''}" data-stage-key="${esc(stage.key)}" type="button" aria-label="${isSubscribed?'Выключить уведомления':'Включить уведомления'}">
            <span aria-hidden="true">🔔</span><span>${isSubscribed?'Включены':'Уведомлять'}</span>
          </button>
          ${showWallet?`<button class="button compact stage-wallet-toggle ${isInWallet?'subscribed':''}" data-wallet-stage-key="${esc(stage.key)}" type="button" aria-label="Добавить ${esc(stage.name)} в Apple Wallet">
            <img class="rfm-icon" src="/assets/wallet.svg" alt="" /><span>${isInWallet?'Wallet ✓':'Wallet'}</span>
          </button>`:''}
        </div>`:''}
      </div>
      ${item.coordinates?`<div class="coordinates-line">${esc(item.coordinates)}</div>`:''}
      <div class="event-list">${events.map(e=>`<div><time>${esc(e.time||'')}</time><span>${esc(e.text||'')}</span></div>`).join('')}</div>`;
    root.appendChild(node);

    const toggle=node.querySelector('[data-stage-key]');
    if(toggle && stage){
      toggle.addEventListener('click',async()=>{
        toggle.disabled=true;
        try{
          const shouldEnable=!subscribedStageKeys(p).has(stage.key);

          if(shouldEnable && !(await getPushSubscription())){
            await enablePushNotifications();
            if(!(await getPushSubscription())) return;
          }

          setStageSubscribed(p,stage.key,shouldEnable);
          const result=await scheduleRaceReminders(p);
          setPushStatus(
            shouldEnable
              ? `${stage.name}: уведомления включены · за 60, 30 и 15 минут.`
              : `${stage.name}: уведомления выключены.`,
            'geo-ok'
          );
          if(result.stored===0 && shouldEnable){
            setPushStatus(`${stage.name}: подписка сохранена, но будущих событий открытия/закрытия пока нет.`);
          }
          renderSchedule(p);
        }catch(e){
          setPushStatus(`Не удалось изменить подписку ${stage.name}: ${e.message}`,'geo-error');
          toggle.disabled=false;
        }
      });
    }

    const walletButton=node.querySelector('[data-wallet-stage-key]');
    if(walletButton && stage){
      walletButton.addEventListener('click',async()=>{
        walletButton.disabled=true;
        try{
          const data=await syncWalletStage(p,item,stage,{openPass:true});
          setWalletStageAdded(p,stage.key);
          setPushStatus(
            data.updated
              ? `${stage.name}: карточка Wallet обновлена.`
              : `${stage.name}: карточка Wallet подготовлена.`,
            'geo-ok'
          );
          renderSchedule(p);
        }catch(e){
          setPushStatus(`Wallet · ${stage.name}: ${e.message}`,'geo-error');
          walletButton.disabled=false;
        }
      });
    }
  }
}

async function selectPackage(id){
  currentPackageId=id; const p=await getPackage(id); if(!p)return;
  $('mapTitle').textContent=p.name;
  const om=p.offlineMap?.ready ? {...p.offlineMap,raceId:(p.offlineMap.storageId||p.id)} : null;
  $('mapSubtitle').textContent=`${om?`ИСПОЛЬЗУЕТСЯ офлайн-подложка · ${om.vectorLayers?.length||0} слоёв · `:navigator.onLine?'онлайн-подложка · ':'офлайн · только локальная геометрия · '}сохранено ${new Date(p.savedAt).toLocaleString()}`;
  try {
    await ensureMapLibre();
    const diag=$('offlineMapDiag');
    if(diag){ diag.hidden=false; diag.textContent=`MapLibre ✓ · WebGL ✓${om?` · локальная подложка ${om.tileCount||0} тайлов`:''}`; }
  } catch(e) {
    const diag=$('offlineMapDiag');
    if(diag){ diag.hidden=false; diag.textContent=`Карта недоступна: ${e.message}`; }
  }
  const carPoint=loadCarPoint();
  const mapGeoJson=carPoint
    ? {...p.geojson,features:[...(p.geojson?.features||[]),{type:'Feature',properties:{kind:'local-car',name:'🚗 Машина'},geometry:{type:'Point',coordinates:[carPoint.lon,carPoint.lat]}}]}
    : p.geojson;
  renderMap($('map'),mapGeoJson,userPos, showPointActions,{offlineMap:om,onMapError:(msg)=>{ const el=$('offlineMapDiag'); if(el){el.hidden=false;el.textContent=`Ошибка карты: ${msg}`;} }});
  updateOfflineMapUi(p);
  renderPointList(p);
  renderFavorites(p);
  renderCarPoint();
  if($('exportGpxBtn')) $('exportGpxBtn').disabled=false;
  if($('exportGeoJsonBtn')) $('exportGeoJsonBtn').disabled=false;
  $('mapLegend').innerHTML='<span><i style="background:#f3f5f7"></i>RallyFansMap</span><span><i style="background:#ffd21e"></i>Yandex Constructor</span><span><i style="background:#4da3ff"></i>вы</span>';
  if ($('importYandexBtn')) { const n=p.yandexImport?.featureCount||0; $('importYandexBtn').textContent=n?`Yandex: ${n} объектов ✓`:'Импорт из Yandex'; $('importYandexBtn').disabled=!p.yandexMapEmbed; }
  $('raceDetails').hidden=false;
  $('raceTitle').textContent=p.name;
  $('raceKicker').textContent=[p.summary?.category,p.summary?.stage].filter(Boolean).join(' / ');
  $('raceMeta').textContent=[p.summary?.dates,p.summary?.city,p.summary?.status].filter(Boolean).join(' · ');
  const hero=$('raceHero'); if(hero) hero.style.backgroundImage=p.original?.image?`url('${assetUrl(p.original.image)}')`:'';
  $('raceStats').innerHTML=[
    ['Общая дистанция',p.summary?.totalDistance],['Боевых км',p.summary?.combatKm],['Дней',p.summary?.days]
  ].filter(x=>x[1]).map(([k,v])=>`<div><strong>${esc(v)}</strong><span>${esc(k)}</span></div>`).join('');
  const img=$('raceImage');
  if(p.original?.image){ img.src=assetUrl(p.original.image); img.hidden=false; img.onerror=()=>img.hidden=true; } else img.hidden=true;
  renderSchedule(p);
  syncWalletPassesForPackage(p).catch(e=>console.warn('Wallet pass refresh failed',e));
  renderRaceMedia(p);
}

async function importObject(data, source){ const pkg=normalizePackage(data,source); await savePackage(pkg); currentPackageId=pkg.id; await refreshList(); await selectPackage(pkg.id); return pkg; }

$('fileInput').addEventListener('change', async e => {
  for (const file of [...e.target.files]) { try { await importObject(JSON.parse(await file.text()), `file:${file.name}`); } catch(err){ alert(`Не удалось импортировать ${file.name}: ${err.message}`); } }
  e.target.value='';
});

function filteredCatalog(){
  const q=$('catalogSearch').value.trim().toLowerCase();
  if(q){
    return catalog.filter(r=>[r.name,r.city_race,r.city_race_details,r.category_race,r.stage_race,r.dates,r.date_race].some(v=>String(v||'').toLowerCase().includes(q)));
  }
  const candidate=pickDefaultRace(catalog.filter(raceWithinWeek));
  return candidate?[candidate]:[];
}

async function downloadedIds(){ return new Set((await getAllPackages()).filter(x=>x.raceId!=null).map(x=>Number(x.raceId))); }

async function renderCatalog(){
  const root=$('catalogList'); if(!root) return;
  const saved=await downloadedIds(); const rows=filteredCatalog();
  if(!rows.length){
    root.innerHTML=$('catalogSearch').value.trim()
      ? '<p class="muted">Ничего не найдено.</p>'
      : '<p class="muted">Нет гонок в пределах недели. Используй поиск.</p>';
    return;
  }
  root.innerHTML=rows.slice().reverse().map(r=>`<article class="catalog-row" style="--race-bg:url('${assetUrl(r.image||'')}')">
    <div class="catalog-shade"></div><div class="catalog-copy"><div class="catalog-tags"><span>${esc(r.status_race||'')}</span><span>${esc(r.stage_race||'')}</span></div><span class="catalog-date">${esc(r.dates||r.date_race||'')}</span><strong>${esc(r.name||`Ралли #${r.id}`)}</strong><span>${esc([r.city_race_details,r.city_race].filter(Boolean).join(' · '))}</span></div>
    <button class="button ${saved.has(Number(r.id))?'downloaded':'primary'}" data-race-id="${Number(r.id)}">${saved.has(Number(r.id))?'Обновить офлайн':'Скачать офлайн'}</button>
  </article>`).join('');
  root.querySelectorAll('[data-race-id]').forEach(btn=>btn.onclick=()=>downloadRace(Number(btn.dataset.raceId),btn));
}

async function downloadRace(id,button){
  const old=button.textContent; button.disabled=true; button.textContent='Загружаю…';
  try{
    const race=await fetchRace(id); let pkg=raceDetailToPackage(race);
    const previous=await getPackage(pkg.id); if(previous?.offlineMap?.ready) pkg.offlineMap=previous.offlineMap;
    button.textContent='Импорт Yandex…';
    try { ({pkg}=await enrichPackageWithYandex(pkg)); } catch(err) { console.warn('Yandex import skipped',err); }
    await savePackage(pkg);
    let assetDownload={cached:0,total:0,background:false};
    if(pkg.assetNames.length){
      assetDownload=await cacheRaceAssets(pkg,(done,total,meta)=>{
        button.textContent=meta?.background?'Материалы скачиваются в фоне…':`Файлы ${done}/${total}`;
      });
    }
    currentPackageId=pkg.id; await refreshList(); await selectPackage(pkg.id);
    try {
      const scheduled=await scheduleRaceReminders(pkg);
      if(scheduled.stored) setPushStatus(`Для этой гонки запланировано напоминаний: ${scheduled.stored}.`,'geo-ok');
    } catch(e) {
      console.warn('Push reminder scheduling skipped',e);
    }
    button.textContent=assetDownload.background?'Данные сохранены · материалы в фоне':'Сохранено ✓';
  }catch(err){ alert(`Не удалось скачать гонку: ${err.message}`); button.textContent=old; }
  finally{ button.disabled=false; }
}

async function refreshSavedYandexImports(){
  if(!navigator.onLine) return {checked:0,updated:0,failed:0};
  const packages=(await getAllPackages()).filter(pkg=>pkg?.raceId!=null);
  let checked=0,updated=0,failed=0;

  for(let pkg of packages){
    try{
      // Refresh the race record first in case the site changed the Constructor
      // iframe itself, not only the points inside an existing map.
      try{
        const race=await fetchRace(pkg.raceId);
        if(race?.iframe_maps) pkg.yandexMapEmbed=race.iframe_maps;
      }catch(e){
        console.warn('Could not refresh race before Yandex import',pkg?.raceId,e);
      }

      if(!pkg?.yandexMapEmbed) continue;
      checked++;
      const result=await enrichPackageWithYandex(pkg);
      await savePackage(result.pkg);
      updated++;
    }catch(e){
      failed++;
      console.warn('Could not refresh Yandex Constructor points',pkg?.raceId,e);
    }
  }

  if(currentPackageId && updated){
    const current=await getPackage(currentPackageId);
    if(current) await selectPackage(currentPackageId);
  }
  return {checked,updated,failed};
}

async function loadCatalog(){
  if(!navigator.onLine){ $('catalogStatus').textContent='Офлайн: доступны уже скачанные гонки.'; catalog=[]; await renderCatalog(); return; }
  $('catalogStatus').textContent='Проверяю serverless proxy…';
  try{
    await checkApiHealth();
    $('catalogStatus').textContent='Загружаю список из api.rallyfansmap.ru…';
    catalog=await fetchRaceCatalog();
    await renderCatalog();

    $('catalogStatus').textContent='Обновляю точки Yandex сохранённых гонок…';
    const yandex=await refreshSavedYandexImports();
    $('catalogStatus').textContent=yandex.checked
      ? `${catalog.length} гонок · Yandex обновлён: ${yandex.updated}${yandex.failed?` · ошибок: ${yandex.failed}`:''}`
      : `${catalog.length} гонок · публичный endpoint /race`;
  }
  catch(err){ $('catalogStatus').textContent=`API недоступен: ${err.message}`; }
}


function updateSpectatorCompass(){
  const display=$('compassDisplay'), status=$('compassStatus'), arrow=$('compassArrow');
  if(!display||!status||!arrow) return;
  if(!selectedPoint){ display.hidden=true; status.textContent='Сначала выбери точку.'; return; }
  if(!userPos){
    display.hidden=true;
    status.textContent='Нужна геопозиция для расчёта направления.';
    return;
  }
  let target;
  try{ target=normalizePoint(selectedPoint); }catch(e){ display.hidden=true; status.textContent=`Не удалось определить координаты точки: ${e?.message || 'неизвестная ошибка'}`; return; }
  const here={lat:Number(userPos.latitude),lon:Number(userPos.longitude)};
  const bearing=bearingDegrees(here,target);
  const distance=distanceMeters(here,target);
  display.hidden=false;
  $('compassDistance').textContent=formatDistance(distance);
  $('compassBearing').textContent=`Азимут ${Math.round(bearing)}° · ${compassDirection(bearing)}`;
  if(Number.isFinite(compassHeading)){
    const relative=((bearing-compassHeading)+360)%360;
    arrow.style.transform=`translate(-50%,-55%) rotate(${relative}deg)`;
    status.textContent=`Курс телефона ${Math.round(compassHeading)}° · точность геопозиции ±${Math.round(userPos.accuracy||0)} м`;
    status.className='muted small geo-ok';
  }else{
    arrow.style.transform=`translate(-50%,-55%) rotate(${bearing}deg)`;
    status.textContent='Направление рассчитано по северу. Разреши доступ к датчику для живого компаса.';
    status.className='muted small';
  }
}
function orientationHandler(event){
  let heading=null;
  if(Number.isFinite(event.webkitCompassHeading)) heading=event.webkitCompassHeading;
  else if(Number.isFinite(event.alpha)) heading=(360-event.alpha)%360;
  if(Number.isFinite(heading)){ compassHeading=heading; updateSpectatorCompass(); }
}
async function enableSpectatorCompass(){
  const btn=$('compassEnableBtn');
  if(btn) btn.disabled=true;
  try{
    if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
      const permission=await DeviceOrientationEvent.requestPermission();
      if(permission!=='granted') throw new Error('доступ к датчику не разрешён');
    }
    if(!compassListening){
      window.addEventListener('deviceorientationabsolute',orientationHandler,true);
      window.addEventListener('deviceorientation',orientationHandler,true);
      compassListening=true;
    }
    if(!userPos) await requestLocation();
    if(btn) btn.textContent='Компас включён';
    updateSpectatorCompass();
  }catch(e){
    const status=$('compassStatus');
    if(status){ status.textContent=`Компас недоступен: ${e.message}`; status.className='muted small geo-error'; }
  }finally{
    if(btn) btn.disabled=false;
  }
}

function showPointActions(point) {
  selectedPoint=point;
  $('pointActions').hidden=false;
  $('pointName').textContent=point.name || 'Точка';
  $('pointCoords').textContent=coordinateText(point);
  $('navStatus').textContent='';
  const compass=$('spectatorCompass'); if(compass) compass.open=false;
  const compassBtn=$('compassEnableBtn'); if(compassBtn) compassBtn.textContent=compassListening?'Компас включён':'Включить компас';
  updateSpectatorCompass();
  syncFavoriteButton();
  $('pointActions').scrollIntoView({behavior:'smooth',block:'nearest'});
}

$('googleMapsBtn').onclick = () => {
  if(!selectedPoint) return;
  window.location.href=googleMapsDirections(selectedPoint);
};
$('yandexMapsBtn').onclick = () => {
  if(!selectedPoint) return;
  $('navStatus').textContent='Открываю Яндекс Навигатор…';
  openCustomSchemeWithFallback(yandexNavigatorLink(selectedPoint), yandexWebFallback(selectedPoint));
};
$('mapsMeBtn').onclick = () => {
  if(!selectedPoint) return;
  $('navStatus').textContent='Открываю MAPS.ME…';
  openCustomSchemeWithFallback(mapsMeLink(selectedPoint), mapsMeWebFallback());
};
$('sharePointBtn').onclick = async () => {
  if(!selectedPoint) return;
  const ok=await sharePoint(selectedPoint);
  $('navStatus').textContent=ok?(navigator.share?'Открыто системное меню «Поделиться».':'Точка скопирована.'):'Не удалось поделиться точкой.';
};
$('compassEnableBtn')?.addEventListener('click',enableSpectatorCompass);
$('spectatorCompass')?.addEventListener('toggle',()=>{ if($('spectatorCompass').open) updateSpectatorCompass(); });


$('favoritePointBtn')?.addEventListener('click',()=>{
  if(!selectedPoint||!currentPackageId) return;
  const enabled=!isFavoritePoint(selectedPoint,currentPackageId);
  setFavoritePoint(selectedPoint,enabled,currentPackageId);
  syncFavoriteButton();
  getPackage(currentPackageId).then(p=>{if(p){renderFavorites(p);renderPointList(p);}});
});

$('saveCarBtn')?.addEventListener('click',()=>{
  const btn=$('saveCarBtn'), status=$('carStatus');
  if(!navigator.geolocation){ if(status) status.textContent='Геолокация не поддерживается.'; return; }
  btn.disabled=true;if(status) status.textContent='Определяю координаты машины…';
  navigator.geolocation.getCurrentPosition(pos=>{
    userPos=pos.coords;
    saveCarPoint({lat:pos.coords.latitude,lon:pos.coords.longitude,name:'Машина'});
    updateLiveUserPosition(userPos);
    updateSpectatorCompass();
    renderCarPoint();btn.disabled=false;
    if(currentPackageId) selectPackage(currentPackageId);
  },err=>{
    if(status) status.textContent=`Не удалось сохранить машину: ${err.message}`;
    btn.disabled=false;
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
});
$('carCompassBtn')?.addEventListener('click',async()=>{
  const pt=loadCarPoint();if(!pt)return;
  showPointActions(pt);
  const details=$('spectatorCompass');if(details) details.open=true;
  await enableSpectatorCompass();
});
$('carGoogleBtn')?.addEventListener('click',()=>{const pt=loadCarPoint();if(pt) window.location.href=googleMapsDirections(pt);});
$('carYandexBtn')?.addEventListener('click',()=>{const pt=loadCarPoint();if(pt) openCustomSchemeWithFallback(yandexNavigatorLink(pt),yandexWebFallback(pt));});
$('carShareBtn')?.addEventListener('click',()=>{const pt=loadCarPoint();if(pt) sharePoint(pt);});
$('carDeleteBtn')?.addEventListener('click',()=>{deleteCarPoint();renderCarPoint();if(selectedPoint?.name==='Машина'||selectedPoint?.name==='🚗 Машина'){$('pointActions').hidden=true;selectedPoint=null;}if(currentPackageId) selectPackage(currentPackageId);});
$('exportGeoJsonBtn')?.addEventListener('click',async()=>{
  if(!currentPackageId)return;
  const p=await getPackage(currentPackageId);if(!p)return;
  downloadBlob(`${safeFileName(p.name)}.geojson`,'application/geo+json;charset=utf-8',JSON.stringify(p.geojson,null,2));
});
$('exportGpxBtn')?.addEventListener('click',async()=>{
  if(!currentPackageId)return;
  const p=await getPackage(currentPackageId);if(!p)return;
  downloadBlob(`${safeFileName(p.name)}.gpx`,'application/gpx+xml;charset=utf-8',geoJsonToGpx(p.geojson,p.name));
});

$('copyCoordsBtn').onclick = async () => {
  if(!selectedPoint) return;
  const text=coordinateText(selectedPoint);
  try { await navigator.clipboard.writeText(text); $('navStatus').textContent=`Скопировано: ${text}`; }
  catch { $('navStatus').textContent=`Координаты: ${text}`; }
};

function mapUiEls(){
  return {
    buttons:[$('downloadMapBtn'),$('downloadMapBtnTop')].filter(Boolean),
    deletes:[$('deleteMapBtn'),$('deleteMapBtnTop')].filter(Boolean),
    statuses:[$('offlineMapStatus'),$('offlineMapStatusTop')].filter(Boolean)
  };
}
function setMapUiText({button,status,deleteHidden,disabled}){
  const els=mapUiEls();
  for(const el of els.buttons){ if(button!=null) el.textContent=button; if(disabled!=null) el.disabled=disabled; }
  for(const el of els.statuses){ if(status!=null) el.textContent=status; }
  for(const el of els.deletes){ if(deleteHidden!=null) el.hidden=deleteHidden; }
}
function updateOfflineMapUi(p){
  if(!p){ setMapUiText({button:'Скачать офлайн-карту',status:'Сначала выбери сохранённую гонку.',deleteHidden:true,disabled:true}); return; }
  if(p?.offlineMap?.ready){
    const layerNames=(p.offlineMap.vectorLayers||[]).map(v=>typeof v==='string'?v:v?.id).filter(Boolean);
    setMapUiText({button:`Обновить карту (${fmtBytes(p.offlineMap.bytes||0)})`,status:`Офлайн-подложка готова · ${p.offlineMap.tileCount||0} тайлов · ${layerNames.length} слоёв · ${fmtBytes(p.offlineMap.bytes||0)} · z${p.offlineMap.minZoom}–${p.offlineMap.maxZoom}${layerNames.length?` · ${layerNames.slice(0,8).join(', ')}`:''}`,deleteHidden:false,disabled:false});
  } else {
    let msg='Офлайн-подложка ещё не скачана.';
    try { const plan=buildDownloadPlan(p.geojson); msg=`Будет скачано до ${plan.tiles.length} векторных тайлов · z${plan.minZoom}–${plan.maxZoom}. Размер зависит от района.`; } catch {}
    setMapUiText({button:'Скачать офлайн-карту',status:msg,deleteHidden:true,disabled:false});
  }
}
async function handleDownloadMap(){
  if(!currentPackageId) return;
  setMapUiText({disabled:true});
  let stagedMap=null;
  let previousMap=null;
  let packageId=currentPackageId;
  try{
    let p=await getPackage(currentPackageId);
    packageId=p.id;
    previousMap=p.offlineMap||null;
    if(navigator.storage?.persist) { try { await navigator.storage.persist(); } catch {} }

    stagedMap=await downloadOfflineMap(p,pr=>{
      setMapUiText({
        button:`Карта ${pr.done}/${pr.total}`,
        status:`Скачано ${pr.saved} тайлов · ${fmtBytes(pr.bytes)}${pr.failed?` · ошибок ${pr.failed}`:''}`
      });
    });

    p.offlineMap=stagedMap;
    await savePackage(p);
    stagedMap=null; // The new revision is now the committed active map.

    if(previousMap){
      try{ await discardOfflineMapRevision(previousMap,p.id); }
      catch(e){ console.warn('Could not remove previous offline map revision',e); }
    }

    await selectPackage(p.id);
    await refreshList();
  }catch(e){
    if(stagedMap){
      try{ await discardOfflineMapRevision(stagedMap); }
      catch(cleanupError){ console.warn('Could not remove staged offline map revision',cleanupError); }
    }
    const msg=`Не удалось скачать карту: ${e.message}`;
    setMapUiText({status:msg});
    alert(msg);
  }finally{
    const p=await getPackage(packageId);
    updateOfflineMapUi(p);
  }
}
async function handleDeleteMap(){
  if(!currentPackageId||!confirm('Удалить офлайн-подложку этой гонки?')) return;
  let p=await getPackage(currentPackageId); await removeOfflineMap(p); delete p.offlineMap; await savePackage(p); await selectPackage(p.id); await refreshList();
}
for(const id of ['downloadMapBtn','downloadMapBtnTop']) if($(id)) $(id).onclick=handleDownloadMap;
for(const id of ['deleteMapBtn','deleteMapBtnTop']) if($(id)) $(id).onclick=handleDeleteMap;

$('catalogSearch').addEventListener('input',renderCatalog);
$('packageSearch')?.addEventListener('input',refreshList);
$('refreshCatalogBtn').onclick=loadCatalog;
$('clearBtn').onclick = async () => { if(!confirm('Удалить все сохранённые гонки, карты, изображения и избранные точки?'))return; localStorage.removeItem(FAVORITES_KEY); await deleteAllPackages(); await clearMapTiles(); if('caches' in window) await caches.delete('rfm-race-assets-v1'); currentPackageId=null; $('raceDetails').hidden=true; $('map').innerHTML='<div class="empty">Офлайн-данные удалены</div>'; await refreshList(); };
async function updateGeoStatus(text, cls='') { const el=$('geoStatus'); if(el){ el.textContent=text; el.className=`muted small ${cls}`; } }

async function requestLocation() {
  if (!navigator.geolocation) { updateGeoStatus('Геолокация не поддерживается этим браузером.'); return; }

  if (geoWatchId != null && userPos) {
    updateLiveUserPosition(userPos,{center:true});
    updateGeoStatus(`Геопозиция включена · точность ±${Math.round(userPos.accuracy||0)} м`,'geo-ok');
    return;
  }

  updateGeoStatus('Запрашиваю доступ к геопозиции…');
  const btn=$('locateBtn');
  if(btn) btn.disabled=true;
  let firstFix=true;

  geoWatchId = navigator.geolocation.watchPosition(pos => {
    userPos=pos.coords;
    updateGeoStatus(`Геопозиция включена · точность ±${Math.round(pos.coords.accuracy||0)} м`,'geo-ok');
    if(btn){
      btn.disabled=false;
      btn.innerHTML='<img class="rfm-icon" src="/assets/location.svg" alt="" />Показать где я';
    }
    updateLiveUserPosition(userPos,{center:firstFix});
    updateSpectatorCompass();
    firstFix=false;
  }, err => {
    if(btn) btn.disabled=false;
    geoWatchId=null;
    const msg=err.code===1
      ? 'Доступ к геопозиции запрещён. Разреши его в настройках сайта.'
      : `Геолокация недоступна: ${err.message}`;
    updateGeoStatus(msg,'geo-error');
  }, {
    enableHighAccuracy:true,
    timeout:15000,
    maximumAge:3000
  });
}
$('locateBtn').onclick = requestLocation;
renderCarPoint();
if($('exportGpxBtn')) $('exportGpxBtn').disabled=!currentPackageId;
if($('exportGeoJsonBtn')) $('exportGeoJsonBtn').disabled=!currentPackageId;

$('importYandexBtn').onclick = async () => {
  if(!currentPackageId) return;
  const btn=$('importYandexBtn'); const old=btn.textContent; btn.disabled=true; btn.textContent='Импортирую…';
  try {
    let p=await getPackage(currentPackageId); const result=await enrichPackageWithYandex(p); p=result.pkg;
    await savePackage(p); await selectPackage(p.id); await refreshList();
    btn.textContent=`Yandex: ${result.imported} объектов ✓`;
  } catch(err) { alert(`Не удалось импортировать Yandex Constructor: ${err.message}`); btn.textContent=old; }
  finally { btn.disabled=false; }
};

const swRegistration=await setupServiceWorkerUpdates();
await ensurePersistentStorage();
await setupPeriodicBackgroundSync(swRegistration);
await refreshPushUi();
try {
  if(await getPushSubscription()) await scheduleAllSavedReminders();
} catch(e) {
  console.warn('Could not refresh scheduled race reminders on startup',e);
}
await refreshList();
window.addEventListener('rfm:background-fetch',event=>{
  const detail=event.detail||{};
  const status=$('catalogStatus');
  if(!status) return;
  if(detail.status==='success') status.textContent='Офлайн-материалы готовы ✓';
  if(detail.status==='failure') status.textContent='Не удалось скачать часть офлайн-материалов.';
});

await loadCatalog();
