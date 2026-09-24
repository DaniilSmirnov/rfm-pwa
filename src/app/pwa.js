let deferredPrompt=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

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
export function isStandalonePwa(){ return pwaLaunchContext().installedLaunch; }

export function installInstructions(){
  if(isIOSDevice()) return {
    title:'Установи Rally Fans Map Offline на экран «Домой»',
    text:'Сейчас приложение открыто как обычная вкладка браузера. На iPhone/iPad часть PWA-возможностей доступна только после установки и запуска с домашнего экрана.',
    steps:['Нажми «Поделиться» в браузере.','Выбери «На экран Домой» / «Add to Home Screen».','Нажми «Добавить», затем открой Rally Fans Map Offline с новой иконки.'],
    action:'Показать инструкцию'
  };
  if(deferredPrompt) return {
    title:'Установи Rally Fans Map Offline',
    text:'Сейчас приложение открыто в браузере. Установи PWA, чтобы запускать его отдельно и надежнее использовать офлайн-режим и уведомления.',
    steps:[],action:'Установить приложение'
  };
  return {
    title:'Открой Rally Fans Map Offline как приложение',
    text:'Сейчас приложение открыто в браузере. Установи его через меню браузера: «Установить приложение» или «Добавить на главный экран».',
    steps:['Открой меню браузера.','Выбери «Установить приложение» или «Добавить на главный экран».','После установки запускай Rally Fans Map Offline с иконки приложения.'],
    action:'Как установить'
  };
}

export function syncInstallUi(){
  const topButton=$('installBtn'),prompt=$('pwaInstallPrompt'),action=$('pwaInstallAction');
  const title=$('pwaInstallTitle'),text=$('pwaInstallText'),steps=$('pwaInstallSteps');
  const ctx=pwaLaunchContext();
  document.documentElement.dataset.pwaInstalled=ctx.installedLaunch?'true':'false';
  document.documentElement.dataset.pwaContext=ctx.installedLaunch?'app':'browser';
  if(ctx.installedLaunch){if(topButton)topButton.hidden=true;if(prompt)prompt.hidden=true;return;}
  const copy=installInstructions();
  if(topButton){topButton.hidden=false;topButton.setAttribute('aria-hidden','false');topButton.textContent='Установить PWA';}
  if(prompt)prompt.hidden=false;if(title)title.textContent=copy.title;if(text)text.textContent=copy.text;if(action)action.textContent=copy.action;
  if(steps){steps.innerHTML=copy.steps.map(step=>`<li>${esc(step)}</li>`).join('');steps.hidden=!copy.steps.length;}
}

export async function requestPwaInstall(){
  if(isStandalonePwa()){syncInstallUi();return;}
  if(deferredPrompt){
    const promptEvent=deferredPrompt;deferredPrompt=null;promptEvent.prompt();
    await promptEvent.userChoice.catch(()=>null);syncInstallUi();return;
  }
  const prompt=$('pwaInstallPrompt'),steps=$('pwaInstallSteps');
  if(prompt){prompt.hidden=false;prompt.scrollIntoView({behavior:'smooth',block:'start'});}
  if(steps)steps.hidden=false;
}

let setupDone=false;
export function setupPwaInstall(){
  if(setupDone)return; setupDone=true; syncInstallUi();
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();if(isStandalonePwa()){deferredPrompt=null;syncInstallUi();return;}deferredPrompt=e;syncInstallUi();});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;syncInstallUi();});
  for(const mode of ['standalone','fullscreen','minimal-ui']) window.matchMedia?.(`(display-mode: ${mode})`).addEventListener?.('change',syncInstallUi);
  window.addEventListener('pageshow',syncInstallUi);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncInstallUi();});
  $('installBtn')?.addEventListener('click',requestPwaInstall);
  $('pwaInstallAction')?.addEventListener('click',requestPwaInstall);
}
