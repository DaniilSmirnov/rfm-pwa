import './CrewResults.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CrewResultsModal from '../modals/CrewResultsModal.jsx';
import {
  deleteCrewSubscription,
  getCrewSubscriptions,
  saveCrewSubscription,
  savePackage,
} from '../db.js';
import { requestCrewResultsBackgroundRefresh } from '../app/runtime.js';
import { asmgRaceIdForPackage } from '../app/asmg-race-map.js';
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

export default function CrewResults({ pkg, open = false, onClose, standalone = false }) {
  const asmgRaceId = asmgRaceIdForPackage(pkg);
  const [data, setData] = useState(() =>
    pkg?.crewResults?.eventResults
      ? {
          eventId: pkg.crewResults.eventId || asmgRaceId,
          eventResults: pkg.crewResults.eventResults,
          tournamentTitle: pkg.crewResults.tournamentTitle || '',
        }
      : null,
  );
  const [, setStatus] = useState(() =>
    pkg?.crewResults?.eventResults
      ? 'Показана сохранённая версия результатов.'
      : 'Загружаю результаты…',
  );
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

  const loadResults = useCallback(
    async (id, { automatic = false } = {}) => {
      if (!id) return;
      if (!automatic) setStatus('Загружаю результаты из ASMG…');
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
      }
    },
    [pkg],
  );

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
  }, [pkg?.id, pkg?.crewResults, asmgRaceId, loadResults]);

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
