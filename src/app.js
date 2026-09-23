import { savePackage, getAllPackages, deleteAllPackages, getPackage, clearMapTiles, getMapStorageStats } from './db.js';
import { normalizePackage } from './normalize.js';
import { renderMap } from './map.js';
import { checkApiHealth, fetchRaceCatalog, fetchRace, raceDetailToPackage, cacheRaceAssets, assetUrl, enrichPackageWithYandex } from './rallyfans.js';
import { googleMapsDirections, yandexNavigatorLink, yandexWebFallback, mapsMeLink, mapsMeWebFallback, coordinateText, openCustomSchemeWithFallback } from './navigation.js';
import { downloadOfflineMap, removeOfflineMap, buildDownloadPlan } from './offline-map.js';

const $ = id => document.getElementById(id);
let currentPackageId = null;
let userPos = null;
let geoWatchId = null;
let deferredPrompt = null;
let catalog = [];
let selectedPoint = null;

const esc = s => String(s ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const asArray = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
function fmtBytes(n=0) { if (n<1024) return `${n} Б`; if(n<1024**2) return `${(n/1024).toFixed(1)} КБ`; return `${(n/1024**2).toFixed(1)} МБ`; }
function updateNetwork() { const online=navigator.onLine; $('networkBadge').textContent=online?'онлайн':'офлайн'; $('networkBadge').className=`badge ${online?'online':'offline'}`; }
window.addEventListener('online',()=>{ updateNetwork(); loadCatalog(); });
window.addEventListener('offline',updateNetwork); updateNetwork();

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt=e; $('installBtn').hidden=false; });
$('installBtn').onclick = async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('installBtn').hidden=true; };

async function refreshList() {
  const pkgs = (await getAllPackages()).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
  const list=$('packageList'); list.innerHTML='';
  if(!pkgs.length) list.innerHTML='<p class="muted">Пока ничего не скачано.</p>';
  for(const p of pkgs){
    const node=$('packageTpl').content.cloneNode(true); const row=node.querySelector('.package-row');
    node.querySelector('.package-name').textContent=p.name;
    const summary=[p.summary?.stage,p.summary?.dates,p.summary?.city].filter(Boolean).join(' · ');
    node.querySelector('.package-meta').textContent=summary || `${p.geojson?.features?.length||0} объектов · ${fmtBytes(p.size)}`;
    row.onclick=()=>selectPackage(p.id); list.appendChild(node);
  }
  const total=pkgs.reduce((s,p)=>s+(p.size||0),0); const mapStats=await getMapStorageStats();
  $('storageStats').innerHTML=`<strong>${pkgs.length} гонок</strong><span class="muted">JSON: ${fmtBytes(total)} · карты: ${fmtBytes(mapStats.bytes)} (${mapStats.count} тайлов)</span>`;
  if (!currentPackageId && pkgs[0]) selectPackage(pkgs[0].id);
  renderCatalog();
}

function pointFeatures(fc) {
  return (fc?.features || []).filter(f => f?.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length >= 2);
}

function pointFromFeature(f) {
  return {
    lat: Number(f.geometry.coordinates[1]),
    lon: Number(f.geometry.coordinates[0]),
    name: String(f.properties?.name || f.properties?.title || 'Точка')
  };
}

function openPointAction(action, point) {
  if (!point) return;
  if (action === 'google') { window.location.href = googleMapsDirections(point); return; }
  if (action === 'yandex') { openCustomSchemeWithFallback(yandexNavigatorLink(point), yandexWebFallback(point)); return; }
  if (action === 'mapsme') { openCustomSchemeWithFallback(mapsMeLink(point), mapsMeWebFallback()); return; }
  if (action === 'copy') {
    const text = coordinateText(point);
    navigator.clipboard?.writeText(text).catch(()=>{});
  }
}

function renderPointList(p) {
  const root = $('pointList');
  if (!root) return;
  const pts = pointFeatures(p.geojson);
  if (!pts.length) { root.innerHTML = '<p class="muted">Точек с координатами нет.</p>'; return; }
  root.innerHTML = pts.map((f, i) => {
    const pt = pointFromFeature(f);
    return `<article class="point-row" data-point-index="${i}">
      <div class="point-row-copy"><strong>${esc(pt.name)}</strong><span class="muted">${esc(coordinateText(pt))}</span></div>
      <div class="point-nav-buttons">
        <button class="button compact primary" data-nav="google">Google Maps</button>
        <button class="button compact" data-nav="yandex">Yandex</button>
        <button class="button compact" data-nav="mapsme">MAPS.ME</button>
        <button class="button compact" data-nav="copy">Копировать</button>
      </div>
    </article>`;
  }).join('');
  root.querySelectorAll('.point-row').forEach((row, i) => {
    const pt = pointFromFeature(pts[i]);
    row.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      openPointAction(btn.dataset.nav, pt);
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('[data-nav]')) return;
      showPointActions(pt);
    });
  });
}

function renderSchedule(p){
  const schedule=asArray(p.original?.schedule);
  const root=$('scheduleList'); root.innerHTML='';
  if(!schedule.length){ root.innerHTML='<p class="muted">Расписание отсутствует.</p>'; return; }
  for(const item of schedule){
    const events=asArray(item.events);
    const node=document.createElement('article'); node.className='schedule-item';
    node.innerHTML=`${item.date?`<div class="date-header">${esc(item.date)}</div>`:''}<div class="location">${esc(item.location||'Событие')}</div>${item.coordinates?`<div class="coordinates-line">${esc(item.coordinates)}</div>`:''}<div class="event-list">${events.map(e=>`<div><time>${esc(e.time||'')}</time><span>${esc(e.text||'')}</span></div>`).join('')}</div>`;
    root.appendChild(node);
  }
}

function legacyImages(obj, keys){ return keys.map(k=>obj?.[k]).filter(v=>typeof v==='string'&&v.trim()); }
function modernImages(items){ return asArray(items).map(x=>x?.image).filter(v=>typeof v==='string'&&v.trim()); }
function unique(arr){ return [...new Set(arr)]; }
function mediaSection(title, images, emptyText='Информация появится позже :)'){
  const list=unique(images);
  return `<section class="race-material"><div class="full-width-line"></div><div class="block-title-row"><div class="block-title">${esc(title)}</div>${list.length>1?'<span class="slide-hint">ЛИСТАЙ →</span>':''}</div>${list.length?`<div class="media-strip">${list.map((name,i)=>`<button class="media-card" data-media-name="${esc(name)}" aria-label="Открыть ${esc(title)} ${i+1}"><img loading="lazy" src="${assetUrl(name)}" alt="${esc(title)}" /></button>`).join('')}</div>`:`<p class="gray-label">${esc(emptyText)}</p>`}</section>`;
}
function renderRaceMedia(p){
  const race=p.original||{};
  const crews=[...modernImages(race.lists),...legacyImages(race,['list_crews','list_crews2','list_crews3','list_crews4','list_crews5'])];
  const results=[...modernImages(race.results),...legacyImages(race,['results_race','results_race2','results_race3','results_race4','results_race5'])];
  const known=new Set([race.image,race.mapsimg,race.safety_leaflet,race.overlap_schedule,...crews,...results].filter(Boolean));
  const extra=(p.assetNames||[]).filter(x=>!known.has(x) && x!== 'name-pin.jpg');
  const root=$('raceMedia');
  root.innerHTML=[
    race.mapsimg?mediaSection('КАРТА ОРГАНИЗАТОРА',[race.mapsimg]):'',
    mediaSection('ПАМЯТКА ПО БЕЗОПАСНОСТИ',race.safety_leaflet?[race.safety_leaflet]:[]),
    mediaSection('ГРАФИК ПЕРЕКРЫТИЙ',race.overlap_schedule?[race.overlap_schedule]:[]),
    mediaSection('ЗАЯВЛЕННЫЕ ЭКИПАЖИ',crews),
    mediaSection('РЕЗУЛЬТАТЫ',results),
    extra.length?mediaSection('МАТЕРИАЛЫ ГОНКИ',extra):'',
    `<section class="race-material"><div class="full-width-line"></div><div class="block-title">КАК ЭТО БЫЛО</div>${race.how_it_was?`<div class="how-it-was">${race.how_it_was}</div>`:'<p class="gray-label">Информация появится позже :)</p>'}</section>`
  ].join('');
  root.querySelectorAll('[data-media-name]').forEach(btn=>btn.addEventListener('click',()=>openImageModal(btn.dataset.mediaName)));
}
function openImageModal(name){ if(!name)return; $('imageModalImg').src=assetUrl(name); $('imageModal').hidden=false; document.body.classList.add('modal-open'); }
function closeImageModal(){ $('imageModal').hidden=true; $('imageModalImg').removeAttribute('src'); document.body.classList.remove('modal-open'); }
$('imageModalClose').onclick=closeImageModal;
$('imageModal').addEventListener('click',e=>{ if(e.target===$('imageModal')) closeImageModal(); });
window.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('imageModal').hidden) closeImageModal(); });

async function selectPackage(id){
  currentPackageId=id; const p=await getPackage(id); if(!p)return;
  $('mapTitle').textContent=p.name;
  const om=p.offlineMap?.ready ? {...p.offlineMap,raceId:p.id} : null;
  $('mapSubtitle').textContent=`${om?'ИСПОЛЬЗУЕТСЯ офлайн-подложка · ':navigator.onLine?'онлайн-подложка · ':'офлайн · только локальная геометрия · '}сохранено ${new Date(p.savedAt).toLocaleString()}`;
  renderMap($('map'),p.geojson,userPos, showPointActions,{offlineMap:om,onMapError:(msg)=>{ const el=$('offlineMapDiag'); if(el){el.hidden=false;el.textContent=`Ошибка карты: ${msg}`;} }});
  updateOfflineMapUi(p);
  renderPointList(p);
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
  renderRaceMedia(p);
}

async function importObject(data, source){ const pkg=normalizePackage(data,source); await savePackage(pkg); currentPackageId=pkg.id; await refreshList(); await selectPackage(pkg.id); return pkg; }

$('fileInput').addEventListener('change', async e => {
  for (const file of [...e.target.files]) { try { await importObject(JSON.parse(await file.text()), `file:${file.name}`); } catch(err){ alert(`Не удалось импортировать ${file.name}: ${err.message}`); } }
  e.target.value='';
});

function filteredCatalog(){
  const q=$('catalogSearch').value.trim().toLowerCase();
  if(!q) return catalog;
  return catalog.filter(r=>[r.name,r.city_race,r.city_race_details,r.category_race,r.stage_race,r.dates].some(v=>String(v||'').toLowerCase().includes(q)));
}

async function downloadedIds(){ return new Set((await getAllPackages()).filter(x=>x.raceId!=null).map(x=>Number(x.raceId))); }

async function renderCatalog(){
  const root=$('catalogList'); if(!root) return;
  const saved=await downloadedIds(); const rows=filteredCatalog();
  if(!rows.length){ root.innerHTML='<p class="muted">Ничего не найдено.</p>'; return; }
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
    if(pkg.assetNames.length){
      await cacheRaceAssets(pkg,(done,total)=>{ button.textContent=`Файлы ${done}/${total}`; });
    }
    currentPackageId=pkg.id; await refreshList(); await selectPackage(pkg.id); button.textContent='Сохранено ✓';
  }catch(err){ alert(`Не удалось скачать гонку: ${err.message}`); button.textContent=old; }
  finally{ button.disabled=false; }
}

async function loadCatalog(){
  if(!navigator.onLine){ $('catalogStatus').textContent='Офлайн: доступны уже скачанные гонки.'; catalog=[]; await renderCatalog(); return; }
  $('catalogStatus').textContent='Проверяю serverless proxy…';
  try{
    await checkApiHealth();
    $('catalogStatus').textContent='Загружаю список из api.rallyfansmap.ru…';
    catalog=await fetchRaceCatalog(); $('catalogStatus').textContent=`${catalog.length} гонок · публичный endpoint /race`; await renderCatalog();
  }
  catch(err){ $('catalogStatus').textContent=`API недоступен: ${err.message}`; }
}

function showPointActions(point) {
  selectedPoint=point;
  $('pointActions').hidden=false;
  $('pointName').textContent=point.name || 'Точка';
  $('pointCoords').textContent=coordinateText(point);
  $('navStatus').textContent='';
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
    setMapUiText({button:`Обновить карту (${fmtBytes(p.offlineMap.bytes||0)})`,status:`Офлайн-подложка готова · ${p.offlineMap.tileCount||0} тайлов · ${fmtBytes(p.offlineMap.bytes||0)} · z${p.offlineMap.minZoom}–${p.offlineMap.maxZoom}`,deleteHidden:false,disabled:false});
  } else {
    let msg='Офлайн-подложка ещё не скачана.';
    try { const plan=buildDownloadPlan(p.geojson); msg=`Будет скачано до ${plan.tiles.length} векторных тайлов · z${plan.minZoom}–${plan.maxZoom}. Размер зависит от района.`; } catch {}
    setMapUiText({button:'Скачать офлайн-карту',status:msg,deleteHidden:true,disabled:false});
  }
}
async function handleDownloadMap(){
  if(!currentPackageId) return;
  setMapUiText({disabled:true});
  try{
    let p=await getPackage(currentPackageId);
    if(navigator.storage?.persist) { try { await navigator.storage.persist(); } catch {} }
    p.offlineMap=await downloadOfflineMap(p,pr=>{ setMapUiText({button:`Карта ${pr.done}/${pr.total}`,status:`Скачано ${pr.saved} тайлов · ${fmtBytes(pr.bytes)}${pr.failed?` · ошибок ${pr.failed}`:''}`}); });
    await savePackage(p); await selectPackage(p.id); await refreshList();
  }catch(e){ const msg=`Не удалось скачать карту: ${e.message}`; setMapUiText({status:msg}); alert(msg); }
  finally{ const p=await getPackage(currentPackageId); updateOfflineMapUi(p); }
}
async function handleDeleteMap(){
  if(!currentPackageId||!confirm('Удалить офлайн-подложку этой гонки?')) return;
  let p=await getPackage(currentPackageId); await removeOfflineMap(p); delete p.offlineMap; await savePackage(p); await selectPackage(p.id); await refreshList();
}
for(const id of ['downloadMapBtn','downloadMapBtnTop']) if($(id)) $(id).onclick=handleDownloadMap;
for(const id of ['deleteMapBtn','deleteMapBtnTop']) if($(id)) $(id).onclick=handleDeleteMap;

$('catalogSearch').addEventListener('input',renderCatalog);
$('refreshCatalogBtn').onclick=loadCatalog;
$('clearBtn').onclick = async () => { if(!confirm('Удалить все сохранённые гонки, карты и изображения?'))return; await deleteAllPackages(); await clearMapTiles(); if('caches' in window) await caches.delete('rfm-race-assets-v1'); currentPackageId=null; $('raceDetails').hidden=true; $('map').innerHTML='<div class="empty">Офлайн-данные удалены</div>'; await refreshList(); };
async function updateGeoStatus(text, cls='') { const el=$('geoStatus'); if(el){ el.textContent=text; el.className=`muted small ${cls}`; } }

async function requestLocation() {
  if (!navigator.geolocation) { updateGeoStatus('Геолокация не поддерживается этим браузером.'); return; }
  updateGeoStatus('Запрашиваю доступ к геопозиции…');
  if (geoWatchId != null) navigator.geolocation.clearWatch(geoWatchId);
  geoWatchId = navigator.geolocation.watchPosition(async pos => {
    userPos=pos.coords;
    updateGeoStatus(`Геопозиция включена · точность ±${Math.round(pos.coords.accuracy||0)} м`,'geo-ok');
    $('locateBtn').textContent='Геопозиция включена ✓';
    if(currentPackageId) await selectPackage(currentPackageId);
  }, err => {
    const msg=err.code===1?'Доступ к геопозиции запрещён. Разреши его в настройках сайта Chrome.':`Геолокация недоступна: ${err.message}`;
    updateGeoStatus(msg,'geo-error');
  }, {enableHighAccuracy:true,timeout:15000,maximumAge:5000});
}
$('locateBtn').onclick = requestLocation;

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

async function setupServiceWorkerUpdates(){
  if(!('serviceWorker' in navigator)) return;
  const banner=$('updateBanner');
  const updateText=$('updateText');
  let reloading=false;
  const showUpdate=(text='Обновляю приложение…')=>{ if(updateText) updateText.textContent=text; if(banner) banner.hidden=false; };

  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading) return;
    reloading=true;
    showUpdate('Новая версия установлена. Перезапускаю…');
    setTimeout(()=>location.reload(),250);
  });

  try {
    const reg=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
    const activateWaiting=()=>{
      if(reg.waiting){ showUpdate(); reg.waiting.postMessage({type:'SKIP_WAITING'}); }
    };
    activateWaiting();
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing;
      if(!worker) return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed' && navigator.serviceWorker.controller){
          showUpdate();
          worker.postMessage({type:'SKIP_WAITING'});
        }
      });
    });

    const check=()=>reg.update().catch(()=>{});
    await check();
    setInterval(check,5*60*1000);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') check(); });
    window.addEventListener('online',check);
  } catch(err) {
    console.error('Service worker registration/update failed',err);
  }
}

await setupServiceWorkerUpdates();
await refreshList();
await loadCatalog();
