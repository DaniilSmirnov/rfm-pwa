import React from 'react';

export default function SavedOfflineSection({app,packages,stats}){
  return <section id="savedRacesSection" className="grid two compact-grid legacy-more">
    <article className="rfm-section">
      <div className="section-head saved-head"><div><div className="block-title">СОХРАНЕНО ОФЛАЙН</div><div id="storageStats" className="stats">{stats}</div></div>
        <input id="packageSearch" className="search" placeholder="Найти сохранённую гонку…" value={app.packageQuery} onChange={event=>app.setPackageQuery(event.target.value)}/>
      </div>
      <div id="packageList" className="package-list">{packages}</div>
      <button id="clearBtn" className="button danger" onClick={app.clearAll}>Удалить все офлайн-данные</button>
    </article>
    <article className="rfm-section"><div className="block-title">РУЧНОЙ ИМПОРТ</div><p className="muted">Запасной путь для GeoJSON/JSON.</p>
      <div className="actions"><label className="button" htmlFor="fileInput">Импортировать файл</label>
        <input id="fileInput" type="file" accept=".json,.geojson,application/json,application/geo+json" hidden multiple onChange={async event=>{
          await app.importFiles([...event.target.files]);event.target.value='';
        }}/>
      </div>
    </article>
  </section>;
}
