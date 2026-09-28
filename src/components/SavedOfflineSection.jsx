import React from 'react';
import Button from './Button.jsx';
import Panel from './Panel.jsx';
import SearchField from './SearchField.jsx';
import SectionHeader from './SectionHeader.jsx';
import ActionGroup from './ActionGroup.jsx';

export default function SavedOfflineSection({ app, packages, stats }) {
  return (
    <section id="savedRacesSection" className="grid two compact-grid legacy-more">
      <Panel as="article">
        <SectionHeader className="saved-head">
          <div>
            <div className="block-title">СОХРАНЕНО ОФЛАЙН</div>
            <div id="storageStats" className="stats">
              {stats}
            </div>
          </div>
          <SearchField
            id="packageSearch"
            placeholder="Найти сохранённую гонку…"
            value={app.packageQuery}
            onChange={event => app.setPackageQuery(event.target.value)}
          />
        </SectionHeader>
        <div id="packageList" className="package-list">
          {packages}
        </div>
        <Button id="clearBtn" className="button danger" onClick={app.clearAll}>
          Удалить все офлайн-данные
        </Button>
      </Panel>
      <Panel as="article">
        <div className="block-title">РУЧНОЙ ИМПОРТ</div>
        <p className="muted">Запасной путь для GeoJSON/JSON.</p>
        <ActionGroup>
          <label className="button" htmlFor="fileInput">
            Импортировать файл
          </label>
          <input
            id="fileInput"
            type="file"
            accept=".json,.geojson,application/json,application/geo+json"
            hidden
            multiple
            onChange={async event => {
              await app.importFiles([...event.target.files]);
              event.target.value = '';
            }}
          />
        </ActionGroup>
      </Panel>
    </section>
  );
}
