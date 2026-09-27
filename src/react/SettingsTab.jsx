import React, { useState } from 'react';
import SafetyGate from './SafetyGate.jsx';

export default function SettingsTab({app,onBack,onDiagnostics}){
  const [safetyOpen,setSafetyOpen]=useState(false);
  return <section className="settings-screen">
    <header className="settings-screen-head"><button className="button compact" onClick={onBack}>← Ещё</button><h2>Настройки и диагностика</h2></header>
    <p className="muted small">Диагностика, правила безопасности и настройки приложения.</p>
    <button className="button" type="button" onClick={()=>setSafetyOpen(true)}>Открыть правила безопасности</button>
    <div className="settings-diagnostics"><strong>Состояние карты</strong><p className="muted small">{app.mapDiag||'Диагностика карты появится, когда откроешь карту.'}</p></div>
    <button className="button" type="button" onClick={onDiagnostics}>Открыть диагностику приложения</button>
    {safetyOpen&&<SafetyGate pkg={app.currentPackage} fullScreen onClose={()=>setSafetyOpen(false)}/>}
  </section>;
}
