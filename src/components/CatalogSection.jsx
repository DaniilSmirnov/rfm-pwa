import React from 'react';

export default function CatalogSection({app,children}){
  return <section id="catalogSection" className="rfm-section legacy-more">
    <div className="section-head"><div><div className="block-title">ГОНКИ</div><p id="catalogStatus" className="muted">{app.catalogStatus}</p></div>
      <input id="catalogSearch" className="search" placeholder="Карелия, Псков…" value={app.catalogQuery} onChange={event=>app.setCatalogQuery(event.target.value)}/>
      <button className="button primary" type="button" onClick={app.loadCatalog}>Обновить каталог</button>
    </div>
    <div id="catalogList" className="catalog-list">{children}</div>
  </section>;
}
