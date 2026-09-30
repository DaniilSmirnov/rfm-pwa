import './RacesView.css';
import React from 'react';
import Button from '../components/Button.jsx';
import CatalogList from '../components/CatalogList.jsx';
import CatalogSection from '../components/CatalogSection.jsx';
import DownloadedRacesList from '../components/DownloadedRacesList.jsx';
import Panel from '../components/Panel.jsx';
import SearchField from '../components/SearchField.jsx';

export default function RacesView({ app, onOpenRace, onBack }) {
  return (
    <section className="races-screen" aria-label="Управление гонками">
      {onBack && (
        <Button className="button compact races-back" onClick={onBack}>
          Назад в меню «Меню»
        </Button>
      )}
      <Panel className="races-preferences">
        <div className="races-section-title">
          <div className="block-title">УПРАВЛЕНИЕ ГОНКАМИ</div>
          <p className="muted small">
            Найди гонку, скачай Rally Pack и управляй сохранёнными гонками.
          </p>
        </div>
        <label className="races-auto-delete">
          <input
            type="checkbox"
            aria-label="Удалять автоматически по завершению гонки"
            checked={app.autoDeleteCompletedRaces}
            onChange={event => app.setAutoDeleteCompletedRaces(event.target.checked)}
          />
          <span>
            <strong>Удалять автоматически по завершению гонки</strong>
            <small>Завершённые Rally Pack будут удаляться с этого устройства.</small>
          </span>
        </label>
      </Panel>

      <Panel className="races-downloaded" aria-labelledby="downloadedRacesTitle">
        <div className="races-list-header">
          <div>
            <div className="block-title" id="downloadedRacesTitle">
              СКАЧАННЫЕ ГОНКИ
            </div>
            <p className="muted small">Сохранённые Rally Pack на этом устройстве.</p>
          </div>
          <SearchField
            aria-label="Найти скачанную гонку"
            placeholder="Название или этап…"
            value={app.packageQuery}
            onChange={event => app.setPackageQuery(event.target.value)}
          />
        </div>
        <DownloadedRacesList app={app} onOpenRace={onOpenRace} />
        <details className="races-import">
          <summary>Импортировать гонку из файла</summary>
          <label className="button" htmlFor="racesFileInput">
            Выбрать JSON или GeoJSON
          </label>
          <input
            id="racesFileInput"
            type="file"
            accept=".json,.geojson,application/json,application/geo+json"
            hidden
            multiple
            onChange={async event => {
              await app.importFiles([...event.target.files]);
              event.target.value = '';
            }}
          />
        </details>
        {app.packages.length > 0 && (
          <Button id="clearBtn" className="button danger races-clear-all" onClick={app.clearAll}>
            Удалить все скачанные гонки
          </Button>
        )}
      </Panel>

      <CatalogSection app={app}>
        <CatalogList app={app} />
      </CatalogSection>
    </section>
  );
}
