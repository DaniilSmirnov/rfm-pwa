import React from 'react';
import { assetUrl } from '../rallyfans.js';
import OfflineMapActions from '../components/OfflineMapActions.jsx';
import './RaceDetails.css';

export default function RaceDetails({app,schedule,media}){
  const pkg=app.currentPackage;
  const stats=[['Общая дистанция',pkg?.summary?.totalDistance],['Боевых км',pkg?.summary?.combatKm],['Дней',pkg?.summary?.days]].filter(([,value])=>value);
  const changes=pkg?.pendingUpdate?.changes||pkg?.lastSmartUpdate?.changes||[];
  return <section id="raceDetails" className="race-page legacy-more" hidden={!pkg}>
    <div className="race-hero" style={{backgroundImage:pkg?.original?.image?`url('${assetUrl(pkg.original.image)}')`:undefined}}>
      <div className="race-hero-overlay"/><div className="race-hero-top"><div className="brand-small light">Rally Fans Map</div>
        <div id="raceKicker" className="race-category">{pkg?[pkg.summary?.category,pkg.summary?.stage].filter(Boolean).join(' / '):''}</div>
      </div>
      <div className="race-hero-bottom"><h2 id="raceTitle">{pkg?.name||''}</h2><p id="raceMeta">{pkg?[pkg.summary?.dates,pkg.summary?.city,pkg.summary?.status].filter(Boolean).join(' · '):''}</p></div>
    </div>
    <div className="race-content">
      <div id="raceStats" className="race-stats">{stats.map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      {Boolean(changes.length)&&<section className="rally-pack-update-panel">
        <div id="rallyPackUpdateTitle" className="block-title">{pkg.pendingUpdate?'ЕСТЬ ОБНОВЛЕНИЕ RALLY PACK':'RALLY PACK ОБНОВЛЁН В ФОНЕ'}</div>
        <strong>{changes.map(item=>item.label||item.key).join(' · ')}</strong>
        <p className="muted small">{pkg.pendingUpdate?'Есть изменения материалов. Старый офлайн-пакет остаётся активным.':'Все необходимые данные были скачаны, поэтому изменения уже применены.'}</p>
      </section>}
      <div className="race-actions-line"><button className="button" disabled={!pkg?.yandexMapEmbed} onClick={app.importYandex}>{pkg?.yandexImport?.featureCount?`Yandex: ${pkg.yandexImport.featureCount} объектов ✓`:'Импорт из Yandex'}</button></div>
      <OfflineMapActions app={app} top/>
      <div className="full-width-line"/><div className="block-title">РАСПИСАНИЕ</div>
      <div id="scheduleList" className="schedule-list">{schedule}</div><div id="raceMedia">{media}</div>
    </div>
  </section>;
}
