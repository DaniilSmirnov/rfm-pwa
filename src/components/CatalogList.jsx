import React from 'react';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import { assetUrl } from '../rallyfans.js';
import './CatalogList.css';

export default function CatalogList({ app }) {
  if (!app.visibleCatalog.length) {
    return (
      <EmptyState>
        {app.catalogQuery.trim()
          ? 'Ничего не найдено.'
          : 'Нет гонок в пределах недели. Используй поиск.'}
      </EmptyState>
    );
  }
  return (
    <>
      {[...app.visibleCatalog].reverse().map(r => {
        const saved = app.downloadedIds.has(Number(r.id));
        const progress = app.raceProgress[r.id];
        return (
          <article
            className="catalog-row"
            key={r.id}
            style={{ '--race-bg': `url('${assetUrl(r.image || '')}')` }}
          >
            <div className="catalog-shade"></div>
            <div className="catalog-copy">
              <div className="catalog-tags">
                <span>{r.status_race || ''}</span>
                <span>{r.stage_race || ''}</span>
              </div>
              <span className="catalog-date">{r.dates || r.date_race || ''}</span>
              <strong>{r.name || `Ралли #${r.id}`}</strong>
              <span>{[r.city_race_details, r.city_race].filter(Boolean).join(' · ')}</span>
            </div>
            <Button
              className={`button ${saved ? 'downloaded' : 'primary'}`}
              data-race-id={Number(r.id)}
              onClick={() => app.downloadRace(Number(r.id))}
            >
              {progress || (saved ? 'Обновить Rally Pack' : 'Скачать Rally Pack')}
            </Button>
          </article>
        );
      })}
    </>
  );
}
