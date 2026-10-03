import './TodayView.css';
import React, { useEffect, useState } from 'react';
import Button from '../../components/Button/Button.jsx';
import ScheduleList from '../../components/ScheduleList/ScheduleList.jsx';
import TodayLeaders from '../../components/TodayLeaders/TodayLeaders.jsx';
import OverlapSchedule from '../../components/OverlapSchedule/OverlapSchedule.jsx';
import sortavalaOverlapSchedule from '../../data/sortavala-overlap-schedule.json';
import { assetUrl } from '../../rallyfans.js';
import { getCrewSubscriptions } from '../../db.js';
import {
  asArray,
  currentScheduledCrew,
  nextProgramItem,
  nextScheduledCrew,
  nextRaceDownloadSuggestion,
  offlineLabel,
  overlaps,
  packageRaceId,
  updateSummary,
} from './logic/today-view-data.js';
import { distanceFromTodayDays, nextUpcomingRace } from './logic/catalog-dates.js';
import { getTodayState } from './logic/today-state.js';
import { isSortavalaRace } from './logic/overlap-schedule.js';
import { todaySummary } from './logic/today-summary.js';
import { crewName, overallCrewResults } from '../ResultsScreen/logic/crew-results.js';

const stateLabels = {
  before: 'ДО СТАРТА',
  running: 'СЕГОДНЯ НА РАЛЛИ',
  'finished-today': 'ЗАВЕРШЕНО СЕГОДНЯ',
  'after-finish': 'ЗАВЕРШЁННАЯ ГОНКА',
};

function RaceCard({ pkg, onDownload, progress, downloaded = false, compact = false }) {
  const raceId = packageRaceId(pkg);
  return (
    <article className={`today-selected-race${compact ? ' compact' : ''}`}>
      <div>
        <div className="eyebrow">ВЫБРАННАЯ ГОНКА</div>
        <h2>{pkg.name || `Ралли #${raceId}`}</h2>
        <p>{pkg.summary?.dates || pkg.original?.dates || 'Даты уточняются'}</p>
        {(pkg.city_race_details || pkg.city_race) && (
          <p className="muted">{pkg.city_race_details || pkg.city_race}</p>
        )}
      </div>
      {!compact && onDownload && (
        <Button className="button primary" onClick={onDownload}>
          {progress || (downloaded ? 'Обновить Rally Pack' : 'Скачать Rally Pack')}
        </Button>
      )}
    </article>
  );
}

function NextRaceCard({ race, progress, downloaded, onDownload }) {
  if (!race) return null;
  const id = Number(race.id);
  return (
    <section className="today-card today-next-race" aria-label="Следующая гонка">
      <div className="block-title">СЛЕДУЮЩАЯ ГОНКА</div>
      <h2>{race.name || `Ралли #${id}`}</h2>
      <p className="muted">{race.dates || race.date_race || 'Дата будет опубликована'}</p>
      <Button
        className="button primary"
        onClick={() => onDownload(id)}
        disabled={!Number.isFinite(id)}
      >
        {progress || (downloaded ? 'Обновить Rally Pack' : 'Скачать Rally Pack')}
      </Button>
    </section>
  );
}

export default function TodayView({ app, onMap, onResults, onRaces }) {
  const [now, setNow] = useState(() => new Date());
  const [subscriptions, setSubscriptions] = useState([]);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  useEffect(() => {
    let active = true;
    getCrewSubscriptions()
      .then(items => active && setSubscriptions(asArray(items)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [app.currentPackage?.id]);

  const selected = app.currentPackage || null;
  const nextCatalogRace = nextUpcomingRace(app.catalog || []);
  const target = selected || nextCatalogRace;
  const pkg = target
    ? (app.packages || []).find(item => packageRaceId(item) === Number(target.id)) ||
      (target === selected ? target : null)
    : null;

  if (!pkg && target) {
    const id = Number(target.id);
    const targetState = getTodayState(target, now).state;
    return (
      <section className="today-screen" data-today-state={targetState}>
        <div className="block-title">СЛЕДУЮЩАЯ ГОНКА</div>
        <RaceCard
          pkg={target}
          progress={app.raceProgress?.[id]}
          downloaded={false}
          onDownload={() => app.downloadRace(id)}
        />
        <section className="today-card">
          <div className="block-title">OFFLINE-ГОТОВНОСТЬ</div>
          <p className="muted">Скачай Rally Pack, чтобы сохранить программу, карту и памятку.</p>
        </section>
      </section>
    );
  }

  if (!pkg) {
    return (
      <section className="today-empty">
        <div className="block-title">Сегодня</div>
        <p className="muted">
          Нет гонки сегодня и нет выбранной гонки. Открой «Гонки», чтобы выбрать Rally Pack.
        </p>
        {onRaces && (
          <Button className="button primary" onClick={onRaces}>
            Открыть гонки
          </Button>
        )}
      </section>
    );
  }

  const raceId = packageRaceId(pkg);
  const stateInfo = getTodayState(pkg, now);
  const state = stateInfo.state;
  const summary = todaySummary(pkg, now);
  const schedule = summary.schedule || [];
  const program = nextProgramItem(pkg, now);
  const changes = updateSummary(pkg);
  const offline = offlineLabel(app, pkg, raceId);
  const nextRace = nextRaceDownloadSuggestion(pkg, app.catalog || [], now);
  const nextRaceId = Number(nextRace?.id);
  const overlapImages = overlaps(pkg.original || pkg);
  const generatedOverlapSchedule = isSortavalaRace(pkg) ? sortavalaOverlapSchedule : null;
  const downloaded = Boolean(app.downloadedIds?.has?.(nextRaceId));
  const saved = Boolean(app.downloadedIds?.has?.(raceId));
  const currentCrew = currentScheduledCrew(pkg);
  const followedCrews = [
    ...subscriptions,
    ...asArray(app.favoriteCrews).map(crew => ({
      key: crew.id || crew.number,
      crewId: crew.id,
      number: crew.number,
      name: crew.name,
      raceId: pkg.raceId || pkg.id,
    })),
  ];
  const nextCrew = nextScheduledCrew(pkg, now);
  const overall = overallCrewResults(pkg.crewResults?.eventResults);
  const favoritePreviews = followedCrews.map(subscription => {
    const result =
      overall.find(row =>
        [row.crew?.id, row.crew?.number].some(
          value => String(value) === String(subscription.crewId || subscription.number),
        ),
      ) || overall[0];
    const latestStage = pkg.crewResults?.eventResults?.at(-1);
    const stageResult = latestStage?.results?.find(row =>
      [row.crew?.id, row.crew?.number].some(
        value => String(value) === String(subscription.crewId || subscription.number),
      ),
    );
    return { subscription, result, latestStage, stageResult };
  });
  const relatedSubscriptions = followedCrews.filter(
    item => String(item.raceId) === String(pkg.raceId || pkg.id),
  );

  return (
    <section className="today-screen" data-today-state={state}>
      {changes && (
        <section
          className={`today-card today-update-summary${changes.pending ? ' pending' : ''}`}
          aria-label="Изменения Rally Pack"
        >
          <div className="block-title">
            {changes.pending ? 'ЕСТЬ ИЗМЕНЕНИЯ' : 'ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ'}
          </div>
          <p>
            {changes.changes.length
              ? changes.changes.map(change => change.label || change.key).join(' · ')
              : 'Изменений нет.'}
          </p>
          {changes.pending && (
            <p className="muted small">Изменения ожидают применения к офлайн-пакету.</p>
          )}
        </section>
      )}

      {state === 'after-finish' ? (
        <>
          <NextRaceCard
            race={nextRace}
            progress={Number.isFinite(nextRaceId) ? app.raceProgress?.[nextRaceId] : null}
            downloaded={downloaded}
            onDownload={app.downloadRace}
          />
          <RaceCard pkg={pkg} compact />
          <p className="muted">
            {distanceFromTodayDays(pkg, now) === 1
              ? 'Гонка завершилась вчера.'
              : 'Гонка завершилась ранее.'}
          </p>
          {pkg.crewResults?.eventResults?.length > 0 && (
            <TodayLeaders pkg={pkg} onResults={onResults} />
          )}
        </>
      ) : (
        <>
          <RaceCard
            pkg={pkg}
            progress={app.raceProgress?.[raceId]}
            downloaded={saved}
            onDownload={saved ? () => app.downloadRace(raceId) : undefined}
          />
          <section className="today-card today-race-status" aria-label="Состояние ралли">
            <div className="today-status-heading">
              <div className="block-title">{stateLabels[state]}</div>
            </div>
            {program ? (
              <>
                <strong>
                  {program.item?.location || program.event?.text || 'Ближайшее событие'}
                </strong>
                <p className="muted">
                  {program.event?.time ? `${program.event.time} · ` : ''}
                  {program.event?.text || 'По опубликованной программе'}{' '}
                  <span className="muted">По расписанию</span>
                </p>
                {currentCrew && (
                  <p className="today-next-crew">
                    <strong>Текущий экипаж:</strong>{' '}
                    {currentCrew.row.crew?.name ||
                      currentCrew.row.name ||
                      currentCrew.row.pilot ||
                      `№ ${currentCrew.row.crewNumber || currentCrew.row.number}`}
                  </p>
                )}
                {!currentCrew && nextCrew && (
                  <p className="today-next-crew">
                    <strong>Следующий экипаж:</strong>{' '}
                    {nextCrew.row.crew?.name ||
                      nextCrew.row.name ||
                      nextCrew.row.pilot ||
                      `№ ${nextCrew.row.crewNumber || nextCrew.row.number}`}
                  </p>
                )}
              </>
            ) : (
              <p className="muted">Ближайшее событие не указано в сохранённой программе.</p>
            )}
            {state === 'running' && onMap && (
              <Button className="button primary today-map-button" onClick={() => onMap()}>
                Показать этап на карте
              </Button>
            )}
          </section>

          {state === 'finished-today' ? (
            <section className="today-card today-finished-summary" aria-label="Итоги гонки">
              <div className="block-title">ГОНКА ЗАВЕРШЕНА</div>
              <p className="muted">Результаты и материалы сохранены для просмотра.</p>
              <div className="today-actions">
                {onResults && (
                  <Button className="button primary" onClick={onResults}>
                    Посмотреть результаты
                  </Button>
                )}
                {onRaces && (
                  <Button className="button secondary" onClick={onRaces}>
                    Материалы гонки
                  </Button>
                )}
              </div>
            </section>
          ) : (
            <section className="today-card">
              <div className="block-title">{summary.scheduleLabel}</div>
              <ScheduleList pkg={pkg} schedule={schedule} onStageSelect={onMap} />
            </section>
          )}
        </>
      )}

      <section className="today-card today-offline-status" aria-label="Готовность офлайн">
        <div className="today-status-heading">
          <div className="block-title">ОФЛАЙН-ГОТОВНОСТЬ</div>
          <span className={`today-state-badge ${offline.saved ? 'ready' : 'planned'}`}>
            {offline.saved ? 'ОФЛАЙН' : 'НЕ СОХРАНЕНО'}
          </span>
        </div>
        <p>{offline.details.join(' · ')}</p>
        <p className="muted small">
          {pkg.lastSmartUpdate?.appliedAt
            ? `Применено: ${pkg.lastSmartUpdate.appliedAt}`
            : pkg.savedAt
              ? `Сохранено: ${pkg.savedAt}`
              : 'Время сохранения не указано.'}
        </p>
      </section>

      {relatedSubscriptions.length > 0 && (
        <section className="today-card" aria-label="Избранные экипажи">
          <div className="block-title">ИЗБРАННЫЕ ЭКИПАЖИ</div>
          <p className="muted">Подписок для этой гонки: {relatedSubscriptions.length}</p>
          {favoritePreviews.map(({ subscription, result, latestStage, stageResult }) => (
            <p key={subscription.key || subscription.crewId}>
              {result
                ? `${crewName(result.crew) || subscription.name} · ${result.formattedTime || ''}`
                : `${index + 1}. № ${subscription.number || subscription.name?.match(/\\d+/)?.[0] || '—'} · ${subscription.name}`}
              {result?.formattedFromLeader
                ? ` · ${result.formattedFromLeader === '00:00:00:0' ? 'лидер' : `+${result.formattedFromLeader}`}`
                : ''}
              {latestStage?.specialStage?.name
                ? ` · ${latestStage.specialStage.name}: ${stageResult?.formattedTime || 'результат не опубликован'}`
                : ''}
            </p>
          ))}
        </section>
      )}

      {generatedOverlapSchedule ? (
        <OverlapSchedule schedule={generatedOverlapSchedule} />
      ) : overlapImages.length > 0 ? (
        <section className="today-card today-overlap" aria-label="График перекрытий">
          <div className="block-title">ГРАФИК ПЕРЕКРЫТИЙ</div>
          {overlapImages.map((name, index) => (
            <img
              key={`${name}-${index}`}
              src={assetUrl(name)}
              alt={`График перекрытий ${index + 1}`}
              loading="lazy"
            />
          ))}
        </section>
      ) : null}

      {state !== 'after-finish' && <TodayLeaders pkg={pkg} onResults={onResults} />}
    </section>
  );
}
