import React from 'react';

export default function SettingsTab({app,onBack,onDiagnostics}){
  return <section className="settings-screen">
    <header className="settings-screen-head"><button className="button compact" onClick={onBack}>← Ещё</button><h2>Настройки и диагностика</h2></header>
    <p className="muted small">Уведомления, каталог, офлайн-хранилище и состояние карты.</p>
    <div className="settings-diagnostics"><strong>Состояние карты</strong><p className="muted small">{app.mapDiag||'Диагностика карты появится, когда откроешь карту.'}</p></div>
    <button className="button" type="button" onClick={onDiagnostics}>Открыть диагностику приложения</button>
  </section>;
}
