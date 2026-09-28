import React from 'react';
import Button from './Button.jsx';
import SearchField from './SearchField.jsx';
import Panel from './Panel.jsx';
import SectionHeader from './SectionHeader.jsx';

export default function CatalogSection({app,children}){
  return <Panel id="catalogSection" className="legacy-more">
    <SectionHeader><div><div className="block-title">ГОНКИ</div><p id="catalogStatus" className="muted">{app.catalogStatus}</p></div>
      <SearchField id="catalogSearch" placeholder="Карелия, Псков…" value={app.catalogQuery} onChange={event=>app.setCatalogQuery(event.target.value)}/>
      <Button className="button primary" type="button" onClick={app.loadCatalog}>Обновить каталог</Button>
    </SectionHeader>
    <div id="catalogList" className="catalog-list">{children}</div>
  </Panel>;
}
