import React, { useEffect, useState } from 'react';
import { enablePushNotifications, getPushStatus, refreshPushUi, sendTestPush } from '../app/push-client.js';

export default function PushSettings(){
  const [push,setPush]=useState({supported:false,requiresInstall:false,active:false,testVisible:false,label:'Включить уведомления'});
  const [status,setStatus]=useState(getPushStatus());
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    const updateStatus=event=>setStatus(event.detail||getPushStatus());
    window.addEventListener('rfm:push-status',updateStatus);
    refreshPushUi().then(value=>{if(active)setPush(value);});
    return()=>{active=false;window.removeEventListener('rfm:push-status',updateStatus);};
  },[]);
  const enable=async()=>{
    setBusy(true);
    try{await enablePushNotifications();setPush(await refreshPushUi({updateStatus:false}));}
    finally{setBusy(false);}
  };
  const sendTest=async()=>{
    setBusy(true);
    try{await sendTestPush();}
    finally{setBusy(false);}
  };
  return <section className="settings-group push-settings" aria-labelledby="pushSettingsTitle">
    <h3 id="pushSettingsTitle">Push-уведомления</h3>
    <p className="muted small">Получай напоминания об открытии и закрытии спецучастков.</p>
    <div className="actions"><button id="pushEnableBtn" className={`button ${push.active?'downloaded':''}`} type="button" disabled={busy||(!push.supported&&!push.requiresInstall)} onClick={()=>void enable()}>{busy?'Подожди…':push.label}</button>{push.testVisible&&<button id="pushTestBtn" className="button" type="button" disabled={busy} onClick={()=>void sendTest()}>Тестовый пуш через 10 сек</button>}</div>
    <p id="pushStatus" className={`muted small ${status.className}`} aria-live="polite">{status.text}</p>
  </section>;
}
