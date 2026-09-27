import React, { useEffect, useState } from 'react';
import SafetyGate from './SafetyGate.jsx';
import { loadThemePreference, resolveTheme, saveThemePreference } from '../app/preferences.js';

export default function SettingsTab({app,onBack,onDiagnostics}){
  const [safetyOpen,setSafetyOpen]=useState(false);
  const [theme,setTheme]=useState(()=>document.documentElement.dataset.theme||resolveTheme(loadThemePreference(),window.matchMedia?.('(prefers-color-scheme: dark)').matches));
  useEffect(()=>{
    const systemTheme=window.matchMedia?.('(prefers-color-scheme: dark)');
    if(!systemTheme?.addEventListener) return undefined;
    const updateTheme=event=>{
      if(loadThemePreference()===null) setTheme(resolveTheme(null,event.matches));
    };
    systemTheme.addEventListener('change',updateTheme);
    return ()=>systemTheme.removeEventListener('change',updateTheme);
  },[]);
  const changeTheme=value=>{
    setTheme(value);
    saveThemePreference(value);
  };
  return <section className="settings-screen">
    <header className="settings-screen-head"><button className="button compact" onClick={onBack}>← Ещё</button><h2>Настройки и диагностика</h2></header>
    <p className="muted small">Диагностика, правила безопасности и настройки приложения.</p>
    <fieldset className="settings-group">
      <legend>Тема оформления</legend>
      <div className="theme-switch" role="group" aria-label="Тема оформления">
        <button className={`theme-option${theme==='light'?' selected':''}`} type="button" aria-pressed={theme==='light'} onClick={()=>changeTheme('light')}>☀ Светлая</button>
        <button className={`theme-option${theme==='dark'?' selected':''}`} type="button" aria-pressed={theme==='dark'} onClick={()=>changeTheme('dark')}>☾ Тёмная</button>
      </div>
      <p className="muted small">Выбор сохраняется на этом устройстве.</p>
    </fieldset>
    <button className="button" type="button" onClick={()=>setSafetyOpen(true)}>Открыть правила безопасности</button>
    <div className="settings-diagnostics"><strong>Состояние карты</strong><p className="muted small">{app.mapDiag||'Диагностика карты появится, когда откроешь карту.'}</p></div>
    <button className="button" type="button" onClick={onDiagnostics}>Открыть диагностику приложения</button>
    {safetyOpen&&<SafetyGate pkg={app.currentPackage} fullScreen onClose={()=>setSafetyOpen(false)}/>}
  </section>;
}
