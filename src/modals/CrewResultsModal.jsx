import './CrewResultsModal.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import SearchField from '../components/SearchField.jsx';
import Button from '../components/Button.jsx';
import SelectField from '../components/SelectField.jsx';

export default function CrewResultsModal({
  open,
  standalone = false,
  onClose,
  data,
  views,
  activeView,
  className,
  onClassChange,
  onStageChange,
  classes,
  query,
  onQueryChange,
  visible,
  selectedClassResults,
  subscriptions,
  onToggleSubscription,
  resultLabel,
  subscriptionKey,
}) {
  const dialog = useRef(null);
  const searchRef = useRef(null);
  const [expandedCrew, setExpandedCrew] = useState('');
  useEffect(() => {
    const node = dialog.current;
    if (!node || standalone) return;
    if (open && !node.open) {
      node.showModal();
      requestAnimationFrame(() => searchRef.current?.focus());
    } else if (!open && node.open) node.close();
  }, [open, standalone]);

  const followedIds = useMemo(
    () => new Set(subscriptions.map(item => String(item.crewId))),
    [subscriptions],
  );
  const rankedRows = useMemo(
    () =>
      visible
        .map((result, index) => ({ result, index }))
        .sort((left, right) => {
          const leftId = String(
            left.result?.crew?.id || left.result?.crew?.number || resultLabel(left.result),
          );
          const rightId = String(
            right.result?.crew?.id || right.result?.crew?.number || resultLabel(right.result),
          );
          return (
            Number(followedIds.has(rightId)) - Number(followedIds.has(leftId)) ||
            left.index - right.index
          );
        }),
    [visible, followedIds, resultLabel],
  );

  const content = (
    <>
      {!standalone && (
        <header className="crew-results-dialog-head">
          <div>
            <h2 id="crewResultsDialogTitle">Результаты экипажей</h2>
            <p className="muted small">Выбери класс, чтобы увидеть весь его состав.</p>
          </div>
          <Button
            className="button crew-results-close"
            type="button"
            aria-label="Закрыть результаты"
            onClick={() => dialog.current?.close()}
          >
            ×
          </Button>
        </header>
      )}
      <div className="crew-results-toolbar">
        <label className="sr-only" htmlFor="crewResultsStage">
          Спецучасток
        </label>
        <SelectField
          id="crewResultsStage"
          className="crew-results-stage"
          value={activeView?.key || ''}
          onChange={event => {
            onStageChange(event.target.value);
            onClassChange('');
          }}
        >
          {views.map(view => (
            <option key={view.key} value={view.key}>
              {view.name}
            </option>
          ))}
        </SelectField>
        <label
          className="sr-only"
          htmlFor={standalone ? 'crewResultsDialogClass' : 'crewResultsDialogClass'}
        >
          Класс
        </label>
        <SelectField
          id="crewResultsDialogClass"
          className="crew-results-stage"
          value={className}
          onChange={event => onClassChange(event.target.value)}
        >
          <option value="">Все классы</option>
          {classes.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <SearchField
          ref={searchRef}
          id="crewResultsSearch"
          placeholder="Поиск по экипажу, номеру или машине…"
          aria-label="Поиск экипажа"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
        />
      </div>
      <div className="crew-results-table-wrap">
        <table className="crew-results-table">
          <thead>
            <tr>
              <th scope="col">Место</th>
              <th scope="col">Экипаж</th>
              <th scope="col">Автомобиль / зачёт</th>
              <th scope="col" id="crewResultsTimeHeading">
                {activeView?.name || 'Время'}
              </th>
              <th scope="col">
                <span className="sr-only">Подписка</span>
              </th>
            </tr>
          </thead>
          <tbody className="crew-results-body">
            {rankedRows.length ? (
              rankedRows.map(({ result }) => {
                const crew = result?.crew || {};
                const id = String(crew.id || crew.number || resultLabel(result));
                const subscribed = subscriptions.some(
                  item => item.key === subscriptionKey(data.eventId, id),
                );
                const place = selectedClassResults.indexOf(result) + 1;
                const retired = result.goingOff || result.goingOffAfterSu;
                const stages = views
                  .slice(1)
                  .map(view => ({
                    view,
                    result: view.results.find(
                      item =>
                        String(item?.crew?.id || item?.crew?.number || resultLabel(item)) === id,
                    ),
                  }))
                  .filter(item => item.result);
                return (
                  <React.Fragment key={id}>
                    <tr
                      data-crew-row
                      data-search={`${crew.number || ''} ${resultLabel(result)} ${crew.car || ''} ${result?.discipline?.name || ''}`.toLocaleLowerCase(
                        'ru',
                      )}
                    >
                      <td className="crew-results-place">{retired ? '—' : place}</td>
                      <td className="crew-results-name">
                        <strong>{resultLabel(result)}</strong>
                        <small>№ {crew.number || '—'}</small>
                        <Button
                          className="button compact crew-details-toggle"
                          type="button"
                          aria-expanded={expandedCrew === id}
                          onClick={() => setExpandedCrew(expandedCrew === id ? '' : id)}
                        >
                          {expandedCrew === id ? 'Скрыть СУ' : 'По СУ'}
                        </Button>
                      </td>
                      <td>
                        {crew.car || 'Автомобиль не указан'}
                        <small>{result?.discipline?.name || 'Зачёт не указан'}</small>
                      </td>
                      <td className="crew-results-time">
                        {retired
                          ? result.reasonGoingOff ||
                            (result.goingOff ? 'Сход' : 'Сход после финиша')
                          : result.formattedTime || 'Время пока недоступно'}
                        {result.formattedTimePenalty && (
                          <small>Штраф {result.formattedTimePenalty}</small>
                        )}
                      </td>
                      <td>
                        <Button
                          className={`button compact crew-subscribe-button ${subscribed ? 'downloaded' : ''}`}
                          type="button"
                          data-subscribe={id}
                          data-name={resultLabel(result)}
                          aria-label={`${subscribed ? 'Отписаться от экипажа' : 'Следить за экипажем'}: ${resultLabel(result)}`}
                          onClick={() => void onToggleSubscription(result)}
                        >
                          {subscribed ? 'Отписаться' : 'Подписаться'}
                        </Button>
                      </td>
                    </tr>
                    {expandedCrew === id && (
                      <tr className="crew-stage-details" data-crew-details={id}>
                        <td colSpan="5">
                          <strong>Результаты по спецучасткам</strong>
                          {stages.length ? (
                            <ol>
                              {stages.map(({ view, result: stageResult }) => (
                                <li key={view.key}>
                                  <span>{view.name}</span>
                                  <span>
                                    {stageResult.goingOff || stageResult.goingOffAfterSu
                                      ? stageResult.reasonGoingOff || 'Сход'
                                      : stageResult.formattedTime || 'Время пока недоступно'}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="muted small">Данные по спецучасткам недоступны.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="crew-results-empty">
                  Экипажи по этому запросу не найдены.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small crew-results-priority-note">
        Экипажи, за которыми вы следите, показаны первыми. Место в протоколе не меняется.
      </p>
    </>
  );

  if (standalone)
    return (
      <section className="crew-results-inline" aria-label="Результаты экипажей">
        {content}
      </section>
    );
  return (
    <dialog
      ref={dialog}
      className="crew-results-dialog"
      aria-labelledby="crewResultsDialogTitle"
      onClose={onClose}
    >
      {content}
    </dialog>
  );
}
