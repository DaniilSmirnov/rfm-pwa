let deferredPrompt=null;
const listeners=new Set();
let removeInstallListeners=null;

export function isIOSDevice(){
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
}

export function pwaLaunchContext() {
  const displayModes=['standalone','fullscreen','minimal-ui'];
  const displayMode=displayModes.find(mode=>window.matchMedia?.(`(display-mode: ${mode})`).matches) || null;
  const iosStandalone=window.navigator.standalone===true;
  const androidAppReferrer=String(document.referrer||'').startsWith('android-app://');
  const installedLaunch=Boolean(displayMode || iosStandalone || androidAppReferrer);
  return {installedLaunch,displayMode,iosStandalone,androidAppReferrer,browserMode:!installedLaunch};
}

export function isStandalonePwa(){return pwaLaunchContext().installedLaunch;}

export function installInstructions({promptAvailable=Boolean(deferredPrompt)}={}){
  if(isIOSDevice()) return {
    title:'Установи Rally Fans Map Offline на экран «Домой»',
    text:'Сейчас приложение открыто как обычная вкладка браузера. На iPhone/iPad часть PWA-возможностей доступна только после установки и запуска с домашнего экрана.',
    steps:['Нажми «Поделиться» в браузере.','Выбери «На экран Домой» / «Add to Home Screen».','Нажми «Добавить», затем открой Rally Fans Map Offline с новой иконки.'],
    action:'Показать инструкцию'
  };
  if(promptAvailable) return {
    title:'Установи Rally Fans Map Offline',
    text:'Сейчас приложение открыто в браузере. Установи PWA, чтобы запускать его отдельно и надёжнее использовать офлайн-режим и уведомления.',
    steps:[],action:'Установить приложение'
  };
  return {
    title:'Открой Rally Fans Map Offline как приложение',
    text:'Сейчас приложение открыто в браузере. Установи его через меню браузера: «Установить приложение» или «Добавить на главный экран».',
    steps:['Открой меню браузера.','Выбери «Установить приложение» или «Добавить на главный экран».','После установки запускай Rally Fans Map Offline с иконки приложения.'],
    action:'Как установить'
  };
}

export function getPwaInstallSnapshot(){
  const context=pwaLaunchContext();
  const promptAvailable=Boolean(deferredPrompt);
  return {...context,promptAvailable,instructions:installInstructions({promptAvailable})};
}

function publishInstallState(){
  const snapshot=getPwaInstallSnapshot();
  for(const listener of listeners) listener(snapshot);
}

export function subscribePwaInstall(listener){
  listeners.add(listener);
  listener(getPwaInstallSnapshot());
  if(!removeInstallListeners){
    const onBeforeInstallPrompt=event=>{
      event.preventDefault();
      if(isStandalonePwa()) return;
      deferredPrompt=event;
      publishInstallState();
    };
    const onInstalled=()=>{deferredPrompt=null;publishInstallState();};
    const onVisibility=()=>{if(document.visibilityState==='visible')publishInstallState();};
    const mediaQueries=['standalone','fullscreen','minimal-ui'].map(mode=>window.matchMedia?.(`(display-mode: ${mode})`)).filter(Boolean);
    window.addEventListener('beforeinstallprompt',onBeforeInstallPrompt);
    window.addEventListener('appinstalled',onInstalled);
    window.addEventListener('pageshow',publishInstallState);
    window.addEventListener('rfm:pwa-install-help',publishInstallState);
    document.addEventListener('visibilitychange',onVisibility);
    for(const media of mediaQueries) media.addEventListener?.('change',publishInstallState);
    removeInstallListeners=()=>{
      window.removeEventListener('beforeinstallprompt',onBeforeInstallPrompt);
      window.removeEventListener('appinstalled',onInstalled);
      window.removeEventListener('pageshow',publishInstallState);
      window.removeEventListener('rfm:pwa-install-help',publishInstallState);
      document.removeEventListener('visibilitychange',onVisibility);
      for(const media of mediaQueries) media.removeEventListener?.('change',publishInstallState);
      removeInstallListeners=null;
    };
  }
  return ()=>{
    listeners.delete(listener);
    if(!listeners.size) removeInstallListeners?.();
  };
}

export async function requestPwaInstall({onInstructions}={}){
  if(isStandalonePwa()) return {installed:true,prompted:false};
  if(!deferredPrompt){
    onInstructions?.();
    window.dispatchEvent(new Event('rfm:pwa-install-help'));
    return {installed:false,prompted:false,instructions:true};
  }
  const promptEvent=deferredPrompt;
  deferredPrompt=null;
  publishInstallState();
  promptEvent.prompt();
  const choice=await promptEvent.userChoice.catch(()=>null);
  publishInstallState();
  return {installed:isStandalonePwa(),prompted:true,choice};
}
