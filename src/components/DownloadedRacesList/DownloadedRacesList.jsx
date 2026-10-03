import React, { useMemo } from 'react';
import Button from '../Button/Button.jsx';
import EmptyState from '../EmptyState/EmptyState.jsx';
import { filterSavedRaces } from '../../app/race-retention.js';
import './DownloadedRacesList.css';

function raceId(pkg) {
  return Number(pkg.raceId || pkg.original?.id || pkg.id);
}

export default function DownloadedRacesList({ app, onOpenRace }) {
  const races = useMemo(
    () => filterSavedRaces(app.packages, app.packageQuery),
    [app.packages, app.packageQuery],
  );
  return (
    <div className="downloaded-races-list" id="packageList">
      {!app.packages.length ? (
        <EmptyState>Скачанных гонок пока нет.</EmptyState>
      ) : !races.length ? (
        <EmptyState>По этому запросу гонок не найдено.</EmptyState>
      ) : (
        races.map(pkg => {
          const id = raceId(pkg);
          const progress = app.raceProgress[id];
          const dates = pkg.summary?.dates || pkg.original?.dates || pkg.original?.date_race || '';
          return (
            <article className="downloaded-race package-row" key={pkg.id}>
              <div className="downloaded-race-copy">
                <Button className="downloaded-race-open" onClick={() => onOpenRace?.(pkg.id)}>
                  {pkg.name || `Ралли #${id}`}
                </Button>
                {dates && <span>{dates}</span>}
              </div>
              <div className="downloaded-race-actions">
                <Button
                  className="button compact primary"
                  onClick={() => app.downloadRace(id)}
                  disabled={!Number.isFinite(id)}
                >
                  {progress || 'Обновить'}
                </Button>
                <Button
                  className="button compact danger"
                  onClick={() => app.deleteRace(pkg.id)}
                  disabled={Boolean(progress)}
                >
                  Удалить
                </Button>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
