import { getAllPackages } from '../db.js';
import { buildRaceReminders } from './schedule.js';
import { subscribedStageKeys } from './preferences.js';
import { isIOSDevice, isStandalonePwa, syncInstallUi, requestPwaInstall } from './pwa.js';
import { fetchWithTimeout } from './net.js';
import { fetchWithTimeout } from './net.js';

const $=id=>document.getElementById(id);

export function base64UrlToUint8Array(value) {
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

export function pushSupported() {
  return Boolean(
    navigator.serviceWorker
    && typeof window.PushManager!=='undefined'
    && typeof window.Notification!=='undefined'
  );
}

export function setPushStatus(text, cls='') {
  const el=$('pushStatus');
  if(el){ el.textContent=text; el.className=`muted small ${cls}`; }
}

export async function getPushSubscription() {
  if(!pushSupported()) return null;
  const reg=await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function refreshPushUi() {
  const enable=$('pushEnableBtn');
  const test=$('pushTestBtn');
  if(!enable || !test) return;
  if(!pushSupported()){
    enable.disabled=true;
    test.hidden=true;
    setPushStatus('Push-уведомления не поддерживаются этим браузером.');
    return;
  }
  if(isIOSDevice() && !isStandalonePwa()){
    enable.disabled=false;
    enable.textContent='Сначала установить PWA';
    enable.classList.remove('downloaded');
    test.hidden=true;
    setPushStatus('Сейчас приложение открыто в браузере. Установи PWA на экран «Домой», затем включи уведомления.');
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

export async function scheduleRaceReminders(pkg){
  if(!pkg || !pushSupported()) return {stored:0,skipped:true};
  const subscription=await getPushSubscription();
  if(!subscription) return {stored:0,skipped:true};
  const raceId=String(pkg.raceId ?? pkg.id ?? '').trim();
  if(!raceId) return {stored:0,skipped:true};
  const reminders=buildRaceReminders(pkg,subscribedStageKeys(pkg));
  const res=await fetchWithTimeout('/api/push/schedule',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({subscription:subscription.toJSON(),raceId,reminders})
  },5000);
  const data=await res.json().catch(()=>({}));
  if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось запланировать напоминания');
  return {stored:Number(data.stored)||0,skipped:false};
}

export async function scheduleAllSavedReminders(){
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

export async function enablePushNotifications() {
  if(isIOSDevice() && !isStandalonePwa()){
    syncInstallUi();
    await requestPwaInstall();
    return refreshPushUi();
  }
  if(!pushSupported()) return refreshPushUi();
  const btn=$('pushEnableBtn');
  btn.disabled=true;
  try {
    const reg=await navigator.serviceWorker.ready;
    const existing=await reg.pushManager.getSubscription();

    if(existing){
      const endpoint=existing.endpoint;
      await existing.unsubscribe();
      fetchWithTimeout('/api/push/unsubscribe',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({endpoint})
      },5000).catch(()=>{});
      setPushStatus('Уведомления выключены.');
      return;
    }

    if(Notification.permission==='denied') throw new Error('Уведомления запрещены в настройках системы');
    const permission=Notification.permission==='granted'
      ? 'granted'
      : await Notification.requestPermission();
    if(permission!=='granted') throw new Error('Разрешение на уведомления не выдано');

    const configRes=await fetchWithTimeout('/api/push/config',{cache:'no-store'},5000);
    const config=await configRes.json();
    if(!config?.enabled || !config?.publicKey) throw new Error('Push ещё не настроен на Cloudflare Pages');

    const subscription=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64UrlToUint8Array(config.publicKey)
    });

    const saveRes=await fetchWithTimeout('/api/push/subscribe',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({subscription:subscription.toJSON()})
    },5000);
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

export async function sendTestPush() {
  const btn=$('pushTestBtn');
  btn.disabled=true;
  try {
    const subscription=await getPushSubscription();
    if(!subscription) throw new Error('Нет активной push-подписки');
    setPushStatus('Отправляю тестовый push…');
    const res=await fetchWithTimeout('/api/push/test',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({subscription:subscription.toJSON(),delaySeconds:10})
    },5000);
    const data=await res.json();
    if(!res.ok || !data?.ok) throw new Error(data?.error || `Push service HTTP ${data?.status||res.status}`);
    setPushStatus('Тестовый push запланирован через 10 секунд. Можно свернуть PWA.','geo-ok');
  } catch(e) {
    setPushStatus(`Тестовый push: ${e.message}`,'geo-error');
  } finally {
    btn.disabled=false;
  }
}


let setupDone=false;
export function setupPushUi(){
  if(setupDone) return;
  setupDone=true;
  $('pushEnableBtn')?.addEventListener('click',enablePushNotifications);
  $('pushTestBtn')?.addEventListener('click',sendTestPush);
}
