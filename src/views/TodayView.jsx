import './TodayView.css';
import React, { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import { assetUrl } from '../rallyfans.js';
import { todaySummary } from '../app/today-summary.js';
import { distanceFromTodayDays, nextUpcomingRace } from '../app/catalog-dates.js';
import TodayLeaders from '../components/TodayLeaders.jsx';
import ScheduleList from '../components/ScheduleList.jsx';
import Notice from '../components/Notice.jsx';
import { raceHasFinished } from '../app/today-summary.js';
import { parseScheduleDateTime } from '../app/schedule.js';
import { crewName, overallCrewResults } from '../app/crew-results.js';
import { getCrewSubscriptions } from '../db.js';

const asArray = value =>
  Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];

function scheduleMoment(item, event, pkg) {
  return parseScheduleDateTime(item?.date, event?.time || item?.time, pkg);
}

function explicitStageState(item, event) {
  const value = String(
    item?.status || item?.state || item?.status_race || event?.status || event?.state || '',
  ).toLocaleLowerCase('ru');
  if (/live|ид[её]т|в эфире|актив/.test(value)) return { label: 'LIVE', kind: 'live' };
  if (/заверш|оконч|состоял|прош|finished|completed/.test(value))
    return { label: 'Завершён', kind: 'done' };
  return { label: 'По расписанию', kind: 'planned' };
}

export function nextProgramItem(pkg, now = new Date()) {
  const events = asArray(pkg?.original?.schedule).flatMap(item =>
    asArray(item?.events).map(event => ({ item, event, moment: scheduleMoment(item, event, pkg) })),
  );
  const liveEvents = events.filter(row => explicitStageState(row.item, row.event).kind === 'live');
  if (liveEvents.length)
    return liveEvents.sort((a, b) => (b.moment?.getTime() || 0) - (a.moment?.getTime() || 0))[0];
  return (
    events
      .filter(row => row.moment && row.moment.getTime() >= now.getTime())
      .sort((a, b) => a.moment - b.moment)[0] || null
  );
}

export function nextScheduledCrew(pkg, now = new Date()) {
  const rows = asArray(pkg?.original?.schedule).flatMap(item => {
    const scheduleRows = [
      ...asArray(item?.crews),
      ...asArray(item?.starts),
      ...asArray(item?.events),
    ];
    return scheduleRows.map(row => ({ item, row, moment: scheduleMoment(item, row, pkg) }));
  });
  return (
    rows
      .filter(
        ({ row, moment }) =>
          moment && moment >= now && (row?.crew || row?.crewNumber || row?.number),
      )
      .sort((a, b) => a.moment - b.moment)[0] || null
  );
}

export function currentScheduledCrew(pkg) {
  const rows = asArray(pkg?.original?.schedule).flatMap(item =>
    [...asArray(item?.crews), ...asArray(item?.starts), ...asArray(item?.events)].map(row => ({
      item,
      row,
    })),
  );
  return (
    rows.find(
      ({ item, row }) =>
        explicitStageState(item, row).kind === 'live' &&
        (row?.crew || row?.crewNumber || row?.number),
    ) || null
  );
}

export function countdownLabel(pkg, now, fallbackDays) {
  const upcomingStarts = asArray(pkg?.original?.schedule)
    .flatMap(item =>
      asArray(item?.events)
        .filter(event => {
          if (/^(?:race[-_ ]?)?start|first[-_ ]?start$/i.test(String(event?.kind || '')))
            return true;
          const text = `${event?.text || ''} ${event?.kind || ''} ${item?.location || ''}`
            .toLocaleLowerCase('ru')
            .replace(/ё/g, 'е');
          return /перв(?:ый|ого)\s+старт|(?:су|ss)\s*1.*старт|старт.*(?:су|ss)\s*1|официальн(?:ый|ого)\s+старт|начал[оа]\s+(?:ралли|соревнован)|rally\s+start|start\s+(?:ss\s*1|stage\s*1)/i.test(
            text,
          );
        })
        .map(event => scheduleMoment(item, event, pkg))
        .filter(Boolean),
    )
    .filter(moment => moment >= now)
    .sort((a, b) => a - b);
  const start = upcomingStarts[0];
  if (!start) return `До начала примерно ${Math.max(1, Math.round(fallbackDays))} дн.`;
  const remainingHours = Math.max(0, Math.floor((start.getTime() - now.getTime()) / 3600000));
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;
  return `До старта ${days} дн. ${hours} ч.`;
}

export function latestPositionChange(eventResults) {
  if (!Array.isArray(eventResults) || eventResults.length < 2) return null;
  const previous = overallCrewResults(eventResults.slice(0, -1));
  const current = overallCrewResults(eventResults);
  const previousPlaces = new Map(
    previous.map((row, index) => [String(row?.crew?.id || row?.crew?.number || ''), index + 1]),
  );
  return (
    current
      .map((row, index) => {
        const key = String(row?.crew?.id || row?.crew?.number || '');
        const before = previousPlaces.get(key);
        const place = index + 1;
        return before && before !== place
          ? {
              crew: row.crew,
              from: before,
              to: place,
              stage: eventResults.at(-1)?.specialStage?.name,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.from - b.to - (a.from - a.to))[0] || null
  );
}

function updateSummary(pkg) {
  const update = pkg?.pendingUpdate || pkg?.lastSmartUpdate;
  return update
    ? { update, changes: asArray(update.changes), pending: Boolean(pkg.pendingUpdate) }
    : null;
}

function offlineLabel(app, pkg, id) {
  const saved = app.downloadedIds?.has?.(id);
  const map = Boolean(pkg?.offlineMap?.ready);
  const terrain = Boolean(pkg?.terrain?.ready);
  return {
    saved,
    details: [
      saved ? 'Пакет сохранён' : 'Пакет не сохранён',
      map ? 'карта готова' : 'карта не загружена',
      terrain ? 'рельеф готов' : 'рельеф не загружен',
    ],
  };
}

function packageRaceId(pkg) {
  return Number(pkg?.raceId || pkg?.original?.id || pkg?.original?.raceId || pkg?.id);
}
function raceImage(race) {
  return race?.original?.image || race?.image || '';
}
function overlaps(race) {
  const value = race?.original?.overlap_schedule || race?.overlap_schedule;
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

export function nextRaceDownloadSuggestion(pkg, catalog, now = new Date()) {
  if (!pkg || !raceHasFinished(pkg, now)) return null;
  const next = nextUpcomingRace(catalog, now);
  if (!next) return null;
  return packageRaceId(pkg) === Number(next.id) ? null : next;
}

export default function TodayView({ app, onMap, onResults, onRaces }) {
  const [now, setNow] = useState(() => new Date());
  const [crewSubscriptions, setCrewSubscriptions] = useState([]);
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
    let alive = true;
    getCrewSubscriptions()
      .then(items => {
        if (alive) setCrewSubscriptions(asArray(items));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [app.currentPackage?.id]);
  const current = app.catalog.find(race => distanceFromTodayDays(race) === 0) || null;
  const upcoming = nextUpcomingRace(app.catalog);
  const target = current || app.currentPackage || upcoming;
  const todayPackage = target
    ? (app.packages || []).find(item => packageRaceId(item) === Number(target.id)) ||
      (target === app.currentPackage ? target : null)
    : null;
  const previousPackage =
    target &&
    app.packages.find(
      item => packageRaceId(item) !== Number(target.id) && raceHasFinished(item, now),
    );
  const storageRecommendation = previousPackage && (
    <Notice
      as="aside"
      variant="warning"
      className="today-storage-recommendation"
      aria-label="Рекомендация по хранилищу"
    >
      <strong>Освободи место</strong>
      <span>
        У тебя скачан предыдущий Rally Pack «{previousPackage.name}». Если он больше не нужен
        офлайн, удали его, чтобы освободить место.
      </span>
      {onRaces && (
        <Button className="button compact today-storage-link" onClick={onRaces}>
          Управлять сохранёнными гонками
        </Button>
      )}
    </Notice>
  );
  const summary = todaySummary(todayPackage, now);
  if (!todayPackage && target) {
    const date = target.dates || target.date_race || '';
    const isToday = target === current;
    const raceId = Number(target.id);
    return (
      <section className="today-screen">
        <article
          className="today-race-card"
          style={{ '--race-bg': `url('${assetUrl(raceImage(target))}')` }}
        >
          <div className="today-race-shade" />
          <div className="today-race-copy">
            <div className="eyebrow">{isToday ? 'ГОНКА СЕГОДНЯ' : 'СЛЕДУЮЩАЯ ГОНКА'}</div>
            <h2>{target.name || `Ралли #${raceId}`}</h2>
            <p>{[date, target.city_race_details, target.city_race].filter(Boolean).join(' · ')}</p>
            <p>
              {isToday
                ? 'Ралли сегодня · программа появится после загрузки Rally Pack.'
                : `До начала примерно ${Math.max(1, Math.round(distanceFromTodayDays(target, now)))} дн. · гонка будет проходить по расписанию RallyFansMap.`}
            </p>
          </div>
          <Button className="button primary" onClick={() => app.downloadRace(raceId)}>
            {app.raceProgress[raceId] || 'Скачать Rally Pack'}
          </Button>
        </article>
        {storageRecommendation}
        <section className="today-card">
          <div className="block-title">РАСПИСАНИЕ</div>
          <p className="muted">
            Скачай Rally Pack, чтобы сохранить программу, карту и памятку по безопасности.
          </p>
        </section>
      </section>
    );
  }
  if (!todayPackage)
    return (
      <section className="today-empty">
        <div className="block-title">Сегодня</div>
        <p className="muted">
          Нет гонки сегодня. Следующая гонка появится здесь, когда будет опубликована на
          RallyFansMap.
        </p>
      </section>
    );
  const raceId = packageRaceId(todayPackage);
  const image = raceImage(todayPackage);
  const refreshProgress = app.raceProgress[raceId];
  const hasSavedPack = app.downloadedIds.has(raceId);
  const overlapImages = overlaps(todayPackage.original || todayPackage);
  const raceFinished = summary.raceFinished || raceHasFinished(todayPackage, now);
  const nextRaceSuggestion = nextRaceDownloadSuggestion(todayPackage, app.catalog, now);
  const nextRaceId = Number(nextRaceSuggestion?.id);
  const nextRaceDownloaded =
    Number.isFinite(nextRaceId) && Boolean(app.downloadedIds?.has?.(nextRaceId));
  const nextRaceProgress = Number.isFinite(nextRaceId) ? app.raceProgress?.[nextRaceId] : null;
  const finishedYesterday = distanceFromTodayDays(todayPackage, now) === 1;
  const isUpcoming =
    packageRaceId(todayPackage) === Number(upcoming?.id) ||
    (!raceFinished && distanceFromTodayDays(todayPackage, now) > 0);
  const nextProgram = nextProgramItem(todayPackage, now);
  const program = nextProgram || null;
  const stageState = explicitStageState(program?.item, program?.event);
  const currentCrew = currentScheduledCrew(todayPackage);
  const nextCrew = currentCrew || nextScheduledCrew(todayPackage, now);
  const changes = updateSummary(todayPackage);
  const offline = offlineLabel(app, todayPackage, raceId);
  const raceKey = String(todayPackage.raceId || todayPackage.original?.id || todayPackage.id);
  const asmgKey = String(
    todayPackage.asmgRaceId ||
      todayPackage.original?.asmg_id ||
      todayPackage.original?.asmgId ||
      '',
  );
  const followedCrews = crewSubscriptions
    .filter(item => item.raceId === raceKey || (asmgKey && item.asmgRaceId === asmgKey))
    .map(item => ({ id: item.crewId, number: item.number, name: item.name }));
  const favoriteCrews = [...asArray(app.favoriteCrews), ...followedCrews].filter(
    (favorite, index, items) =>
      items.findIndex(
        item => String(item.id || item.number) === String(favorite.id || favorite.number),
      ) === index,
  );
  const overall = overallCrewResults(todayPackage.crewResults?.eventResults);
  const favoriteRows = favoriteCrews
    .map(favorite => ({
      favorite,
      position: overall.findIndex(row =>
        [row.crew?.id, row.crew?.number].some(
          value => String(value) === String(favorite.id || favorite.number),
        ),
      ),
    }))
    .filter(row => row.position >= 0)
    .map(row => {
      const result = overall[row.position];
      const stage = todayPackage.crewResults?.eventResults?.at(-1);
      const stageResult = stage?.results?.find(item =>
        [item.crew?.id, item.crew?.number].some(
          value => String(value) === String(row.favorite.id || row.favorite.number),
        ),
      );
      return { ...row, result, stage, stageResult };
    });
  const latestResults = asArray(todayPackage.crewResults?.eventResults).at(-1);
  const latestWinner = asArray(latestResults?.results)
    .filter(row => Number(row?.time) > 0 && !row?.goingOff && !row?.goingOffAfterSu)
    .sort((a, b) => Number(a.time) - Number(b.time))[0];
  const positionChange = latestPositionChange(todayPackage.crewResults?.eventResults);
  return (
    <section className="today-screen">
      {nextRaceSuggestion && (
        <Notice
          as="aside"
          variant="warning"
          className="today-next-race-recommendation"
          aria-label="Следующая гонка доступна"
        >
          <div className="today-next-race-copy">
            <strong>Следующая гонка уже доступна</strong>
            <span>
              {nextRaceSuggestion.name || `Ралли #${nextRaceId}`}
              {(nextRaceSuggestion.dates || nextRaceSuggestion.date_race) &&
                ` · ${nextRaceSuggestion.dates || nextRaceSuggestion.date_race}`}
            </span>
          </div>
          <Button
            className="button primary"
            onClick={() => app.downloadRace(nextRaceId)}
            disabled={!Number.isFinite(nextRaceId)}
          >
            {nextRaceProgress ||
              (nextRaceDownloaded ? 'Обновить Rally Pack' : 'Скачать Rally Pack')}
          </Button>
        </Notice>
      )}
      <article className="today-race-card" style={{ '--race-bg': `url('${assetUrl(image)}')` }}>
        <div className="today-race-shade" />
        <div className="today-race-copy">
          <div className="eyebrow">
            {raceFinished
              ? 'ГОНКА ЗАВЕРШЕНА'
              : current
                ? 'ГОНКА СЕГОДНЯ'
                : isUpcoming
                  ? 'СЛЕДУЮЩАЯ ГОНКА'
                  : 'сохранённая гонка'}
          </div>
          <h2>{todayPackage.name}</h2>
          <p>{todayPackage.summary?.dates || 'Расписание сохранено офлайн'}</p>
          {isUpcoming && distanceFromTodayDays(todayPackage, now) > 0 && (
            <p className="today-countdown">
              {countdownLabel(todayPackage, now, distanceFromTodayDays(todayPackage, now))}
            </p>
          )}
        </div>
        {!raceFinished && (
          <Button
            className="button primary"
            onClick={() => app.downloadRace(raceId)}
            disabled={!Number.isFinite(raceId)}
          >
            {refreshProgress || (hasSavedPack ? 'Обновить Rally Pack' : 'Скачать Rally Pack')}
          </Button>
        )}
      </article>
      {storageRecommendation}
      <section className="today-card today-race-status" aria-label="Состояние ралли">
        <div className="today-status-heading">
          <div className="block-title">{raceFinished ? 'ИТОГ РАЛЛИ' : 'СЕЙЧАС НА РАЛЛИ'}</div>
          {program && (
            <span className={`today-state-badge ${stageState.kind}`}>{stageState.label}</span>
          )}
        </div>
        {raceFinished ? (
          <p className="muted">Ралли завершено. Доступны сохранённые результаты и материалы.</p>
        ) : program ? (
          <>
            <strong>{program.item.location || program.event.text || 'Ближайшее событие'}</strong>
            <p className="muted">
              {program.event.time ? `${program.event.time} · ` : ''}
              {program.event.text || program.item.location || 'По опубликованной программе'}
            </p>
            {stageState.kind !== 'live' && (
              <p className="muted small">Текущий live-статус этапа не опубликован.</p>
            )}
            {onMap && (
              <Button className="button primary today-map-button" onClick={() => onMap()}>
                Показать этап на карте
              </Button>
            )}
          </>
        ) : (
          <p className="muted">Ближайшее событие не указано в сохранённой программе.</p>
        )}
        {nextCrew && (
          <p className="today-next-crew">
            <strong>{currentCrew ? 'Текущий экипаж:' : 'Следующий экипаж:'}</strong>{' '}
            {nextCrew.row.crew?.name ||
              nextCrew.row.name ||
              nextCrew.row.pilot ||
              `№ ${nextCrew.row.crewNumber || nextCrew.row.number}`}
            {nextCrew.row.time && ` · ${nextCrew.row.time}`}
          </p>
        )}
      </section>
      {raceFinished ? (
        <section className="today-card">
          <div className="block-title">ГОНКА ЗАВЕРШЕНА</div>
          <p className="muted">
            {finishedYesterday ? 'Гонка завершилась вчера.' : 'Эта гонка уже завершилась.'}
          </p>
        </section>
      ) : (
        <section className="today-card">
          <div className="block-title">{summary.scheduleLabel}</div>
          <ScheduleList pkg={todayPackage} schedule={summary.schedule} onStageSelect={onMap} />
        </section>
      )}
      {favoriteRows.length > 0 && (
        <section className="today-card today-favorite-crews" aria-label="Избранные экипажи">
          <div className="block-title">ИЗБРАННЫЕ ЭКИПАЖИ</div>
          {favoriteRows.map(({ favorite, result, position, stage, stageResult }) => (
            <div className="today-favorite-row" key={favorite.id || favorite.number}>
              <strong>
                {position + 1}. № {result.crew?.number || favorite.number || '—'} ·{' '}
                {crewName(result.crew) || favorite.name}
              </strong>
              <span>
                {result.discipline?.name || 'Общий зачёт'} · {result.formattedTime}
                {result.formattedFromLeader &&
                  ` · ${result.formattedFromLeader === '00:00:00:0' ? 'лидер' : `+${result.formattedFromLeader}`}`}
                {stage?.specialStage?.name &&
                  ` · ${stage.specialStage.name}: ${stageResult?.formattedTime || 'результат не опубликован'}`}
              </span>
            </div>
          ))}
        </section>
      )}
      {latestWinner && (
        <section className="today-card today-recent-event" aria-label="Последнее событие">
          <div className="block-title">ПОСЛЕДНЕЕ В РЕЗУЛЬТАТАХ</div>
          <p>
            {latestResults.specialStage?.name || 'Последний СУ'} · лучший сохранённый результат:{' '}
            <strong>
              № {latestWinner.crew?.number || '—'} {crewName(latestWinner.crew)}
            </strong>
            {latestWinner.formattedTime ? ` · ${latestWinner.formattedTime}` : ''}
          </p>
          <p className="muted small">
            Обновлено: {todayPackage.crewResults?.updatedAt || 'время обновления не указано'}
          </p>
          {positionChange && (
            <p>
              {positionChange.stage ? `${positionChange.stage} · ` : ''}
              {crewName(positionChange.crew) || `Экипаж № ${positionChange.crew?.number || '—'}`}:
              место {positionChange.from} → {positionChange.to}
            </p>
          )}
        </section>
      )}
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
              : 'Список изменений пуст.'}
          </p>
          {changes.update.appliedAt && (
            <p className="muted small">Применено: {changes.update.appliedAt}</p>
          )}
          {changes.pending && (
            <p className="muted small">Изменения ещё не применены к сохранённому офлайн-пакету.</p>
          )}
        </section>
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
          {todayPackage.lastSmartUpdate?.appliedAt
            ? `Последняя синхронизация: ${todayPackage.lastSmartUpdate.appliedAt}`
            : todayPackage.savedAt
              ? `Сохранено: ${todayPackage.savedAt}`
              : 'Время последнего обновления не указано.'}
        </p>
      </section>
      {overlapImages.length > 0 && (
        <section className="today-card today-overlap">
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
      )}
      {!raceFinished ? (
        <TodayLeaders key={todayPackage.id} pkg={todayPackage} onResults={onResults} />
      ) : (
        todayPackage.crewResults?.eventResults?.length > 0 && (
          <TodayLeaders key={todayPackage.id} pkg={todayPackage} />
        )
      )}
    </section>
  );
}
