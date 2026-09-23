import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';
window.maplibregl = maplibregl;
import { savePackage, getAllPackages, deleteAllPackages, getPackage, clearMapTiles, getMapStorageStats } from './db.js';
import { normalizePackage } from './normalize.js';
import { renderMap, updateLiveUserPosition } from './map.js';
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

function startOfLocalDay(date=new Date()) {
  return new Date(date.getFullYear(),date.getMonth(),date.getDate());
}
function parseDdMmYyyy(value) {
  const m=String(value||'').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if(!m) return null;
  const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  return Number.isNaN(d.getTime())?null:d;
}
function raceDateRange(race) {
  const raw=String(race?.dates || race?.summary?.dates || race?.date_race || '').trim();
  const matches=[...raw.matchAll(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/g)];
  if(matches.length){
    const dates=matches.map(m=>new Date(Number(m[3]),Number(m[2])-1,Number(m[1]))).filter(d=>!Number.isNaN(d.getTime()));
    if(dates.length) return {start:dates[0],end:dates[dates.length-1]};
  }
  const single=parseDdMmYyyy(raw);
  return single?{start:single,end:single}:null;
}
function distanceFromTodayDays(race) {
  const range=raceDateRange(race); if(!range) return Infinity;
  const today=startOfLocalDay();
  const start=startOfLocalDay(range.start), end=startOfLocalDay(range.end);
  if(today>=start && today<=end) return 0;
  const target=today<start?start:end;
  return Math.abs(target-today)/86400000;
}
function raceWithinWeek(race){ return distanceFromTodayDays(race)<=7; }
function pickDefaultRace(rows) {
  const dated=rows.filter(r=>Number.isFinite(distanceFromTodayDays(r)));
  if(!dated.length) return null;
  return dated.slice().sort((a,b)=>distanceFromTodayDays(a)-distanceFromTodayDays(b))[0] || null;
}
function updateNetwork() { const online=navigator.onLine; $('networkBadge').textContent=online?'онлайн':'офлайн'; $('networkBadge').className=`badge ${online?'online':'offline'}`; }
window.addEventListener('online',()=>{ updateNetwork(); loadCatalog(); });
window.addEventListener('offline',updateNetwork); updateNetwork();

function isStandalonePwa() {
  const modes=['standalone','fullscreen','minimal-ui'];
  const displayMode=modes.some(mode=>window.matchMedia?.(`(display-mode: ${mode})`).matches);
  const iosStandalone=window.navigator.standalone===true;
  const androidAppReferrer=document.referrer?.startsWith('android-app://');
  return Boolean(displayMode || iosStandalone || androidAppReferrer);
}
function syncInstallButton() {
  const btn=$('installBtn');
  if(!btn) return;
  const shouldHide=isStandalonePwa() || !deferredPrompt;
  btn.hidden=shouldHide;
  btn.setAttribute('aria-hidden',shouldHide?'true':'false');
  btn.style.display=shouldHide?'none':'';
}
syncInstallButton();

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  if(isStandalonePwa()) {
    deferredPrompt=null;
    syncInstallButton();
    return;
  }
  deferredPrompt=e;
  syncInstallButton();
});
window.addEventListener('appinstalled',()=>{
  deferredPrompt=null;
  syncInstallButton();
});
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',syncInstallButton);

$('installBtn').onclick = async () => {
  if(isStandalonePwa() || !deferredPrompt) {
    syncInstallButton();
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  syncInstallButton();
};

function base64UrlToUint8Array(value) {
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function setPushStatus(text, cls='') {
  const el=$('pushStatus');
  if(el){ el.textContent=text; el.className=`muted small ${cls}`; }
}

async function getPushSubscription() {
  if(!pushSupported()) return null;
  const reg=await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function refreshPushUi() {
  const enable=$('pushEnableBtn');
  const test=$('pushTestBtn');
  if(!enable || !test) return;
  if(!pushSupported()){
    enable.disabled=true;
    test.hidden=true;
    setPushStatus('Push-уведомления не поддерживаются этим браузером.');
    return;
  }
  if(/iPhone|iPad|iPod/i.test(navigator.userAgent) && !isStandalonePwa()){
    enable.disabled=false;
    test.hidden=true;
    setPushStatus('На iOS push работает после установки PWA на экран «Домой».');
    return;
  }
  const sub=await getPushSubscription().catch(()=>null);
  if(sub){
    enable.textContent='Выключить уведомления';
    enable.classList.add('downloaded');
    test.hidden=false;
    setPushStatus('Устройство подписано на уведомления.');
  } else {
    enable.textContent='Включить уведомления';
    enable.classList.remove('downloaded');
    test.hidden=true;
    const p=Notification.permission;
    setPushStatus(p==='denied'
      ? 'Уведомления запрещены в настройках браузера/системы.'
      : 'Уведомления ещё не включены.');
  }
}

function raceYearHint(pkg){
  const raw=String(pkg?.summary?.dates || pkg?.original?.dates || pkg?.original?.date_race || '');
  const m=raw.match(/\b(20\d{2})\b/);
  return m?Number(m[1]):new Date().getFullYear();
}
function parseScheduleDateTime(dateText,timeText,pkg){
  const time=String(timeText||'').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if(!time) return null;
  const raw=String(dateText||'').trim();
  let d=raw.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
  let day,month,year;
  if(d){
    day=Number(d[1]); month=Number(d[2]); year=Number(d[3]);
  } else {
    d=raw.match(/\b(\d{1,2})[.\/-](\d{1,2})\b/);
    if(!d) return null;
    day=Number(d[1]); month=Number(d[2]); year=raceYearHint(pkg);
  }
  const result=new Date(year,month-1,day,Number(time[1]),Number(time[2]),0,0);
  if(result.getFullYear()!==year || result.getMonth()!==month-1 || result.getDate()!==day) return null;
  return result;
}

const STAGE_PUSH_PREFS_KEY='rfm-stage-push-subscriptions-v1';

function normalizeStageKey(name){
  return String(name||'')
    .toLowerCase()
    .replace(/ё/g,'е')
    .replace(/[^a-zа-я0-9]+/gi,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80);
}

function stageIdentity(item){
  const events=asArray(item?.events);
  const context=[item?.location,...events.map(e=>e?.text)]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g,' ')
    .trim();

  const stageMatch=context.match(/(?:^|\s)((?:СУ|SS)\s*[-№#]?\s*\d+[A-Za-zА-Яа-я0-9/-]*)/i);
  const hasStageWord=/\bСУ\b|\bSS\b|спец(?:иальный)?\s*участ/i.test(context);
  if(!stageMatch && !hasStageWord) return null;

  const name=(stageMatch?.[1] || String(item?.location||'СУ')).replace(/\s+/g,' ').trim();
  const key=normalizeStageKey(name);
  return key?{key,name}:null;
}

function loadStagePushPrefs(){
  try{
    const parsed=JSON.parse(localStorage.getItem(STAGE_PUSH_PREFS_KEY)||'{}');
    return parsed && typeof parsed==='object' ? parsed : {};
  }catch{
    return {};
  }
}

function racePushPrefId(pkg){
  return String(pkg?.raceId ?? pkg?.id ?? '');
}

function subscribedStageKeys(pkg){
  const raceId=racePushPrefId(pkg);
  const prefs=loadStagePushPrefs();
  return new Set(Array.isArray(prefs[raceId])?prefs[raceId]:[]);
}

function setStageSubscribed(pkg,stageKey,enabled){
  const raceId=racePushPrefId(pkg);
  if(!raceId || !stageKey) return;
  const prefs=loadStagePushPrefs();
  const set=new Set(Array.isArray(prefs[raceId])?prefs[raceId]:[]);
  if(enabled) set.add(stageKey); else set.delete(stageKey);
  if(set.size) prefs[raceId]=[...set];
  else delete prefs[raceId];
  localStorage.setItem(STAGE_PUSH_PREFS_KEY,JSON.stringify(prefs));
}

function classifyStageScheduleEvent(item,event){
  const eventText=String(event?.text||'').trim();
  const context=`${String(item?.location||'')} ${eventText}`.replace(/\s+/g,' ').trim();
  const lower=eventText.toLowerCase();

  let kind=null;
  if(/\bзакрыт|закрытие|закрывается|закрывают|перекрыт|перекрытие/.test(lower)) kind='close';
  else if(/\bоткрыт|открытие|открывается|открывают|возобнов/.test(lower)) kind='open';
  if(!kind) return null;

  const stageMatch=context.match(/(?:^|\s)((?:СУ|SS)\s*[-№#]?\s*\d+[A-Za-zА-Яа-я0-9/-]*)/i);
  const hasStageWord=/\bСУ\b|\bSS\b|спец(?:иальный)?\s*участ/i.test(context);
  if(!stageMatch && !hasStageWord) return null;

  const stageName=(stageMatch?.[1] || String(item?.location||'') || 'СУ')
    .replace(/\s+/g,' ')
    .trim();

  return {kind,stageName,stageKey:normalizeStageKey(stageName),eventText};
}

function reminderLeadLabel(minutes){
  if(minutes===60) return '1 час';
  return `${minutes} мин`;
}

function buildRaceReminders(pkg){
  const schedule=asArray(pkg?.original?.schedule);
  const raceId=pkg?.raceId ?? pkg?.id ?? 'race';
  const now=Date.now();
  const reminders=[];
  const leadTimes=[60,30,15];
  const subscribed=subscribedStageKeys(pkg);
  if(!subscribed.size) return reminders;

  for(const item of schedule){
    for(const event of asArray(item?.events)){
      const classified=classifyStageScheduleEvent(item,event);
      if(!classified || !subscribed.has(classified.stageKey)) continue;

      const startsAt=parseScheduleDateTime(item?.date,event?.time,pkg);
      if(!startsAt) continue;

      for(const leadMinutes of leadTimes){
        const dueAt=startsAt.getTime()-leadMinutes*60*1000;
        if(dueAt<=now || dueAt>now+14*24*60*60*1000) continue;

        const action=classified.kind==='close'?'Закрытие':'Открытие';
        const stageSlug=classified.stageName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,40)||'stage';

        reminders.push({
          dueAt,
          title:String(pkg?.name || 'Rally Fans Map'),
          body:`${action} ${classified.stageName} через ${reminderLeadLabel(leadMinutes)} · ${String(event?.time||'').trim()}`,
          url:'/',
          tag:`rfm-race-${raceId}-${classified.kind}-${stageSlug}-${leadMinutes}`,
          ttlSeconds:Math.max(1800,leadMinutes*60)
        });
      }
    }
  }

  return reminders
    .sort((a,b)=>a.dueAt-b.dueAt)
    .slice(0,192);
}

async function scheduleRaceReminders(pkg){
  if(!pkg || !pushSupported()) return {stored:0,skipped:true};
  const subscription=await getPushSubscription();
  if(!subscription) return {stored:0,skipped:true};
  const raceId=String(pkg.raceId ?? pkg.id ?? '').trim();
  if(!raceId) return {stored:0,skipped:true};
  const reminders=buildRaceReminders(pkg);
  const res=await fetch('/api/push/schedule',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({subscription:subscription.toJSON(),raceId,reminders})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось запланировать напоминания');
  return {stored:Number(data.stored)||0,skipped:false};
}

async function scheduleAllSavedReminders(){
  const pkgs=await getAllPackages();
  let total=0;
  for(const pkg of pkgs){
    try{
      const result=await scheduleRaceReminders(pkg);
      total+=result.stored||0;
    }catch(e){
      console.warn('Could not schedule race reminders',pkg?.id,e);
    }
  }
  return total;
}

async function enablePushNotifications() {
  if(!pushSupported()) return refreshPushUi();
  const btn=$('pushEnableBtn');
  btn.disabled=true;
  try {
    const reg=await navigator.serviceWorker.ready;
    const existing=await reg.pushManager.getSubscription();

    if(existing){
      const endpoint=existing.endpoint;
      await existing.unsubscribe();
      fetch('/api/push/unsubscribe',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({endpoint})
      }).catch(()=>{});
      setPushStatus('Уведомления выключены.');
      return;
    }

    if(Notification.permission==='denied') throw new Error('Уведомления запрещены в настройках системы');
    const permission=Notification.permission==='granted'
      ? 'granted'
      : await Notification.requestPermission();
    if(permission!=='granted') throw new Error('Разрешение на уведомления не выдано');

    const configRes=await fetch('/api/push/config',{cache:'no-store'});
    const config=await configRes.json();
    if(!config?.enabled || !config?.publicKey) throw new Error('Push ещё не настроен на Cloudflare Pages');

    const subscription=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64UrlToUint8Array(config.publicKey)
    });

    const saveRes=await fetch('/api/push/subscribe',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({subscription:subscription.toJSON()})
    });
    const saved=await saveRes.json();
    if(!saveRes.ok || !saved?.ok) throw new Error(saved?.error || 'Не удалось сохранить push-подписку');
    if(saved.stored){
      const count=await scheduleAllSavedReminders();
      setPushStatus(count
        ? `Уведомления включены · запланировано напоминаний: ${count}.`
        : 'Уведомления включены. Будущих событий для напоминаний пока нет.');
    } else {
      setPushStatus('Уведомления включены. KV-хранилище ещё не подключено: доступен тестовый push.');
    }
  } catch(e) {
    setPushStatus(`Push: ${e.message}`,'geo-error');
  } finally {
    btn.disabled=false;
    await refreshPushUi();
  }
}

async function sendTestPush() {
  const btn=$('pushTestBtn');
  btn.disabled=true;
  try {
    const subscription=await getPushSubscription();
    if(!subscription) throw new Error('Нет активной push-подписки');
    setPushStatus('Отправляю тестовый push…');
    const res=await fetch('/api/push/test',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({subscription:subscription.toJSON(),delaySeconds:10})
    });
    const data=await res.json();
    if(!res.ok || !data?.ok) throw new Error(data?.error || `Push service HTTP ${data?.status||res.status}`);
    setPushStatus('Тестовый push запланирован через 10 секунд. Можно свернуть PWA.','geo-ok');
  } catch(e) {
    setPushStatus(`Тестовый push: ${e.message}`,'geo-error');
  } finally {
    btn.disabled=false;
  }
}

$('pushEnableBtn')?.addEventListener('click',enablePushNotifications);
$('pushTestBtn')?.addEventListener('click',sendTestPush);

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
  $('storageStats').innerHTML=`<strong>${pkgs.length} гонок</strong><span class="muted">JSON: ${fmtBytes(total)} · карты: ${fmtBytes(mapStats.bytes)} (${mapStats.count} тайлов)</span>`;

  if (!currentPackageId && visible[0]) selectPackage(visible[0].id);
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
  if (action === 'share') { sharePoint(point); return; }
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
      <div class="point-row-copy"><strong><img class="rfm-icon point-icon" src="/assets/location.svg" alt="" />${esc(pt.name)}</strong><span class="muted">${esc(coordinateText(pt))}</span></div>
      <div class="point-nav-buttons">
        <button class="button compact primary" data-nav="google">Google Maps</button>
        <button class="button compact" data-nav="yandex">Yandex</button>
        <button class="button compact" data-nav="mapsme">MAPS.ME</button>
        <button class="button compact" data-nav="share">Поделиться</button>
        <button class="button compact" data-nav="copy"><img class="rfm-icon" src="/assets/document-copy.svg" alt="" />Копировать</button>
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

  const subscribed=subscribedStageKeys(p);

  for(const item of schedule){
    const events=asArray(item.events);
    const stage=stageIdentity(item);
    const isSubscribed=Boolean(stage && subscribed.has(stage.key));

    const node=document.createElement('article');
    node.className='schedule-item';
    node.innerHTML=`${item.date?`<div class="date-header">${esc(item.date)}</div>`:''}
      <div class="schedule-location-row">
        <div class="location">${esc(item.location||'Событие')}</div>
        ${stage?`<button class="button compact stage-push-toggle ${isSubscribed?'subscribed':''}" data-stage-key="${esc(stage.key)}" type="button">${isSubscribed?'🔔 Уведомления включены':'🔔 Уведомлять'}</button>`:''}
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
  }
}

function legacyImages(obj, keys){ return keys.map(k=>obj?.[k]).filter(v=>typeof v==='string'&&v.trim()); }
function modernImages(items){ return asArray(items).map(x=>x?.image).filter(v=>typeof v==='string'&&v.trim()); }
function unique(arr){ return [...new Set(arr)]; }
function mediaSection(title, images, emptyText='Информация появится позже :)'){
  const list=unique(images);
  const count=list.length ? ` · ${list.length}` : '';
  return `<details class="race-material collapsible-section">
    <summary><span class="block-title">${esc(title)}</span><span class="summary-meta">${esc(count)}</span><span class="summary-chevron">⌄</span></summary>
    <div class="collapsible-body">${list.length?`<div class="media-strip">${list.map((name,i)=>`<button class="media-card" data-media-name="${esc(name)}" aria-label="Открыть ${esc(title)} ${i+1}"><img loading="lazy" src="${assetUrl(name)}" alt="${esc(title)}" /></button>`).join('')}</div>`:`<p class="gray-label">${esc(emptyText)}</p>`}</div>
  </details>`;
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
    `<details class="race-material collapsible-section"><summary><span class="block-title">КАК ЭТО БЫЛО</span><span class="summary-chevron">⌄</span></summary><div class="collapsible-body">${race.how_it_was?`<div class="how-it-was">${race.how_it_was}</div>`:'<p class="gray-label">Информация появится позже :)</p>'}</div></details>`
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
  $('mapSubtitle').textContent=`${om?`ИСПОЛЬЗУЕТСЯ офлайн-подложка · ${om.vectorLayers?.length||0} слоёв · `:navigator.onLine?'онлайн-подложка · ':'офлайн · только локальная геометрия · '}сохранено ${new Date(p.savedAt).toLocaleString()}`;
  try {
    await ensureMapLibre();
    const diag=$('offlineMapDiag');
    if(diag){ diag.hidden=false; diag.textContent=`MapLibre ✓ · WebGL ✓${om?` · локальная подложка ${om.tileCount||0} тайлов`:''}`; }
  } catch(e) {
    const diag=$('offlineMapDiag');
    if(diag){ diag.hidden=false; diag.textContent=`Карта недоступна: ${e.message}`; }
  }
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
    if(pkg.assetNames.length){
      await cacheRaceAssets(pkg,(done,total)=>{ button.textContent=`Файлы ${done}/${total}`; });
    }
    currentPackageId=pkg.id; await refreshList(); await selectPackage(pkg.id);
    try {
      const scheduled=await scheduleRaceReminders(pkg);
      if(scheduled.stored) setPushStatus(`Для этой гонки запланировано напоминаний: ${scheduled.stored}.`,'geo-ok');
    } catch(e) {
      console.warn('Push reminder scheduling skipped',e);
    }
    button.textContent='Сохранено ✓';
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
$('sharePointBtn').onclick = async () => {
  if(!selectedPoint) return;
  const ok=await sharePoint(selectedPoint);
  $('navStatus').textContent=ok?(navigator.share?'Открыто системное меню «Поделиться».':'Точка скопирована.'):'Не удалось поделиться точкой.';
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
$('packageSearch')?.addEventListener('input',refreshList);
$('refreshCatalogBtn').onclick=loadCatalog;
$('clearBtn').onclick = async () => { if(!confirm('Удалить все сохранённые гонки, карты и изображения?'))return; await deleteAllPackages(); await clearMapTiles(); if('caches' in window) await caches.delete('rfm-race-assets-v1'); currentPackageId=null; $('raceDetails').hidden=true; $('map').innerHTML='<div class="empty">Офлайн-данные удалены</div>'; await refreshList(); };
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
await refreshPushUi();
try {
  if(await getPushSubscription()) await scheduleAllSavedReminders();
} catch(e) {
  console.warn('Could not refresh scheduled race reminders on startup',e);
}
await refreshList();
await loadCatalog();
