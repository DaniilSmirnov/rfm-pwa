import './CrewResults.css';
import React, { useEffect, useMemo, useState } from 'react';
import Button from './Button.jsx';
import CrewResultsModal from '../modals/CrewResultsModal.jsx';
import SearchField from './SearchField.jsx';
import SelectField from './SelectField.jsx';
import SectionHeader from './SectionHeader.jsx';
import {
  deleteCrewSubscription,
  getCrewSubscriptions,
  saveCrewSubscription,
  savePackage,
} from '../db.js';
import { requestCrewResultsBackgroundRefresh } from '../app/runtime.js';
import {
  crewResultClasses,
  crewResultViews,
  fetchAsmgResults,
  filterCrewResultsByClass,
  visibleCrewResults,
} from '../app/crew-results.js';

const resultLabel = result =>
  [
    [result?.crew?.pilot?.lastName, result?.crew?.pilot?.firstName].filter(Boolean).join(' '),
    [result?.crew?.navigator?.lastName, result?.crew?.navigator?.firstName]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join(' / ') || `Экипаж № ${result?.crew?.number || '—'}`;
const subscriptionKey = (raceId, crewId) => `${raceId}:${crewId}`;

export default function CrewResults({ pkg, open = false, onOpen, onClose, standalone = false }) {
  const asmgRaceId = String(
    pkg?.asmgRaceId ?? pkg?.original?.asmg_id ?? pkg?.original?.asmgId ?? '55',
  );
  const [raceId, setRaceId] = useState(asmgRaceId);
  const [data, setData] = useState(() =>
    pkg?.crewResults?.eventResults
      ? {
          eventId: pkg.crewResults.eventId || asmgRaceId,
          eventResults: pkg.crewResults.eventResults,
          tournamentTitle: pkg.crewResults.tournamentTitle || '',
        }
      : null,
  );
  const [status, setStatus] = useState(() =>
    pkg?.crewResults?.eventResults
      ? 'Показана сохранённая версия результатов.'
      : 'Загружаю результаты…',
  );
  const [busy, setBusy] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [stageKey, setStageKey] = useState('overall');
  const [className, setClassName] = useState('');
  const [query, setQuery] = useState('');
  const views = useMemo(() => crewResultViews(data?.eventResults), [data]);
  const activeView = views.find(view => view.key === stageKey) || views[0];
  const classes = useMemo(() => crewResultClasses(activeView?.results), [activeView]);
  const visible = useMemo(
    () => visibleCrewResults(activeView?.results, query, { className, limitToTopThree: false }),
    [activeView, query, className],
  );

  useEffect(() => {
    setRaceId(asmgRaceId);
  }, [asmgRaceId]);
  useEffect(() => {
    let cancelled = false;
    const saved = pkg?.crewResults;
    setData(
      Array.isArray(saved?.eventResults)
        ? {
            eventId: saved.eventId || asmgRaceId,
            eventResults: saved.eventResults,
            tournamentTitle: saved.tournamentTitle || '',
          }
        : null,
    );
    setStageKey('overall');
    setClassName('');
    setQuery('');
    if (saved?.eventResults)
      setStatus(
        `Показана сохранённая версия результатов${saved.updatedAt ? ` · ${new Date(saved.updatedAt).toLocaleString()}` : ''}.`,
      );
    else setStatus(asmgRaceId ? 'Загружаю результаты…' : 'Введи номер гонки на asmg.ru.');
    getCrewSubscriptions()
      .then(items => {
        if (!cancelled) setSubscriptions(items);
      })
      .catch(() => {});
    const update = event => {
      if (event.detail?.scope && event.detail.scope !== 'crew-results') return;
      if (asmgRaceId) void loadResults(asmgRaceId, { automatic: true });
    };
    window.addEventListener('rfm:periodic-update', update);
    if (asmgRaceId) void loadResults(asmgRaceId, { automatic: true });
    return () => {
      cancelled = true;
      window.removeEventListener('rfm:periodic-update', update);
    };
  }, [pkg?.id]);

  async function loadResults(id, { automatic = false } = {}) {
    if (!id) return;
    if (!automatic) setBusy(true);
    if (!automatic) setStatus('Загружаю результаты АСМГ…');
    try {
      const next = await fetchAsmgResults(id);
      const snapshot = {
        eventId: next.eventId,
        eventResults: next.eventResults,
        tournamentTitle: next.tournamentTitle || '',
      };
      const updatedPackage = {
        ...pkg,
        asmgRaceId: id,
        crewResults: { ...snapshot, updatedAt: next.updatedAt || new Date().toISOString() },
      };
      await savePackage(updatedPackage);
      setRaceId(id);
      setData(snapshot);
      setStageKey('overall');
      setClassName('');
      setQuery('');
      setStatus(
        `${next.tournamentTitle ? `${next.tournamentTitle} · ` : ''}${next.eventResults.length} спецучастка · сохранено для офлайн-доступа.`,
      );
      window.dispatchEvent(
        new CustomEvent('rfm:crew-results-updated', {
          detail: { packageId: pkg.id, results: updatedPackage.crewResults },
        }),
      );
    } catch (error) {
      setStatus(
        automatic
          ? `Нет новых данных. ${error.message || error} Если результаты уже загружались, проверь, что для этой гонки сохранена последняя версия приложения.`
          : `${error.message || error} Проверь номер гонки и подключение.`,
      );
    } finally {
      if (!automatic) setBusy(false);
    }
  }

  async function toggleSubscription(result) {
    const crewId = String(result?.crew?.id || result?.crew?.number || resultLabel(result));
    const name = resultLabel(result);
    const key = subscriptionKey(data.eventId, crewId);
    try {
      if (subscriptions.some(item => item.key === key)) {
        await deleteCrewSubscription(key);
        setSubscriptions(items => items.filter(item => item.key !== key));
        setStatus(`Подписка на экипаж ${name} отключена.`);
      } else {
        const subscription = {
          key,
          asmgRaceId: String(data.eventId),
          crewId,
          name,
          raceId: String(pkg.raceId ?? pkg.id),
          raceName: pkg.name,
          addedAt: new Date().toISOString(),
        };
        await saveCrewSubscription(subscription);
        setSubscriptions(items => [...items, subscription]);
        setStatus(
          `Экипаж ${name} добавлен. Результаты будут обновляться при периодической синхронизации и сохраняться офлайн.`,
        );
      }
      requestCrewResultsBackgroundRefresh(
        await navigator.serviceWorker?.ready?.catch?.(() => null),
      );
    } catch (error) {
      setStatus(`Не удалось изменить подписку: ${error.message || error}`);
    }
  }

  if (!pkg) return null;
  const selectedClassResults = filterCrewResultsByClass(activeView?.results, className);
  return (
    <>
      <section
        className="crew-results-section"
        hidden={!standalone}
        aria-labelledby="crewResultsTitle"
      >
        <SectionHeader>
          <div>
            <div id="crewResultsTitle" className="block-title">
              {standalone ? 'ДАННЫЕ АСМГ' : 'РЕЗУЛЬТАТЫ ЭКИПАЖЕЙ'}
            </div>
            {!standalone && (
              <p className="muted small">Открой таблицу, когда захочешь посмотреть результаты.</p>
            )}
          </div>
          <Button
            className="button primary"
            id="crewResultsOpen"
            type="button"
            hidden={!data || standalone}
            onClick={onOpen}
          >
            Открыть результаты
          </Button>
        </SectionHeader>
        {data && (
          <div className="crew-results-class-filter" id="crewResultsClassFilter">
            <label htmlFor="crewResultsClass">Класс</label>
            <SelectField
              id="crewResultsClass"
              className="crew-results-stage"
              value={className}
              onChange={event => setClassName(event.target.value)}
            >
              <option value="">Все классы</option>
              {classes.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <form
          className="crew-results-controls"
          onSubmit={event => {
            event.preventDefault();
            void loadResults(raceId);
          }}
        >
          <label htmlFor="asmgRaceId">Номер гонки на АСМГ</label>
          <div className="crew-results-load">
            <SearchField
              id="asmgRaceId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={raceId}
              onChange={event => setRaceId(event.target.value)}
              aria-label="Номер гонки на АСМГ"
            />
            <Button className="button compact primary" type="submit" disabled={busy}>
              {busy ? 'Загрузка…' : data ? 'Обновить' : 'Загрузить результаты'}
            </Button>
          </div>
        </form>
        <p className="muted small crew-results-status" aria-live="polite">
          {status}
        </p>
      </section>
      <CrewResultsModal
        open={open}
        standalone={standalone}
        onClose={onClose}
        data={data}
        views={views}
        activeView={activeView}
        className={className}
        onClassChange={setClassName}
        onStageChange={setStageKey}
        classes={classes}
        query={query}
        onQueryChange={setQuery}
        visible={visible}
        selectedClassResults={selectedClassResults}
        subscriptions={subscriptions}
        onToggleSubscription={toggleSubscription}
        resultLabel={resultLabel}
        subscriptionKey={subscriptionKey}
      />
    </>
  );
}
