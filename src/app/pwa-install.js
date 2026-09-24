export function isIOSDevice(nav=globalThis.navigator){
  return /iPad|iPhone|iPod/i.test(nav?.userAgent||'') || (nav?.platform==='MacIntel' && Number(nav?.maxTouchPoints)>1);
}
export function pwaLaunchContext({win=globalThis.window,doc=globalThis.document,nav=globalThis.navigator}={}){
  const displayModes=['standalone','fullscreen','minimal-ui'];
  const displayMode=displayModes.find(mode=>win?.matchMedia?.(`(display-mode: ${mode})`).matches)||null;
  const iosStandalone=nav?.standalone===true;
  const androidAppReferrer=String(doc?.referrer||'').startsWith('android-app://');
  const installedLaunch=Boolean(displayMode||iosStandalone||androidAppReferrer);
  return {installedLaunch,displayMode,iosStandalone,androidAppReferrer,browserMode:!installedLaunch};
}
export function isStandalonePwa(context){ return (context||pwaLaunchContext()).installedLaunch; }

export function createPwaInstaller({getElement,escapeHtml=String,win=window,doc=document,nav=navigator}={}){
  let deferredPrompt=null;
  const context=()=>pwaLaunchContext({win,doc,nav});
  const installed=()=>isStandalonePwa(context());

  function instructions(){
    if(isIOSDevice(nav)) return {
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

  function syncInstallUi(){
    const topButton=getElement('installBtn'),prompt=getElement('pwaInstallPrompt'),action=getElement('pwaInstallAction'),title=getElement('pwaInstallTitle'),text=getElement('pwaInstallText'),steps=getElement('pwaInstallSteps');
    const ctx=context();
    doc.documentElement.dataset.pwaInstalled=ctx.installedLaunch?'true':'false';
    doc.documentElement.dataset.pwaContext=ctx.installedLaunch?'app':'browser';
    if(ctx.installedLaunch){if(topButton)topButton.hidden=true;if(prompt)prompt.hidden=true;return;}
    const copy=instructions();
    if(topButton){topButton.hidden=false;topButton.setAttribute('aria-hidden','false');topButton.textContent='Установить PWA';}
    if(prompt)prompt.hidden=false;if(title)title.textContent=copy.title;if(text)text.textContent=copy.text;if(action)action.textContent=copy.action;
    if(steps){steps.innerHTML=copy.steps.map(step=>`<li>${escapeHtml(step)}</li>`).join('');steps.hidden=!copy.steps.length;}
  }

  async function requestPwaInstall(){
    if(installed()){syncInstallUi();return;}
    if(deferredPrompt){
      const event=deferredPrompt;deferredPrompt=null;event.prompt();await event.userChoice.catch(()=>null);syncInstallUi();return;
    }
    const prompt=getElement('pwaInstallPrompt'),steps=getElement('pwaInstallSteps');
    if(prompt){prompt.hidden=false;prompt.scrollIntoView({behavior:'smooth',block:'start'});}
    if(steps)steps.hidden=false;
  }

  function setup(){
    syncInstallUi();
    win.addEventListener('beforeinstallprompt',e=>{e.preventDefault();if(installed()){deferredPrompt=null;syncInstallUi();return;}deferredPrompt=e;syncInstallUi();});
    win.addEventListener('appinstalled',()=>{deferredPrompt=null;syncInstallUi();});
    for(const mode of ['standalone','fullscreen','minimal-ui']) win.matchMedia?.(`(display-mode: ${mode})`).addEventListener?.('change',syncInstallUi);
    win.addEventListener('pageshow',syncInstallUi);
    doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')syncInstallUi();});
    const top=getElement('installBtn'),action=getElement('pwaInstallAction');
    if(top)top.onclick=requestPwaInstall;if(action)action.onclick=requestPwaInstall;
  }

  return {setup,syncInstallUi,requestPwaInstall,isStandalonePwa:installed,installInstructions:instructions,get deferredPrompt(){return deferredPrompt;}};
}
